const express = require("express");
const bodyParser = require("body-parser");
const translator = require("@parvineyvazov/json-translator");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();  
const port = 3000;

app.use(bodyParser.json());

// Helper function to validate translation completeness
function validateTranslation(original, translated) {
  const originalKeys = getAllKeys(original);
  const translatedKeys = getAllKeys(translated);
  
  const missingKeys = originalKeys.filter(key => !translatedKeys.includes(key));
  const completeness = ((originalKeys.length - missingKeys.length) / originalKeys.length) * 100;
  
  return {
    isComplete: missingKeys.length === 0,
    completeness: completeness,
    missingKeys: missingKeys,
    totalKeys: originalKeys.length,
    translatedKeys: translatedKeys.length
  };
}

// Helper function to get all keys from nested object
function getAllKeys(obj, prefix = '') {
  let keys = [];
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        keys = keys.concat(getAllKeys(obj[key], fullKey));
      } else if (Array.isArray(obj[key])) {
        keys.push(fullKey);
        obj[key].forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            keys = keys.concat(getAllKeys(item, `${fullKey}[${index}]`));
          }
        });
      } else {
        keys.push(fullKey);
      }
    }
  }
  return keys;
}

// Enhanced translation endpoint with retry logic and fallback
app.post("/translate-multiple", async (req, res) => {
  const { data, toLanguages, retryAttempts = 3, minimumCompleteness = 95 } = req.body;

  if (!data || !Array.isArray(toLanguages) || toLanguages.length === 0) {
    return res.status(400).json({ error: "Provide 'data' and 'toLanguages' array (ISO codes)." });
  }

  const id = uuidv4();
  const tempDir = path.join("/tmp", `translate-${id}`);
  fs.mkdirSync(tempDir);

  try {
    const inputFilePath = path.join(tempDir, "input.json");
    fs.writeFileSync(inputFilePath, JSON.stringify(data, null, 2));

    const from = req.body.from || 'auto';
    const name = `myApp-${id}`;
    const concurrencylimit = req.body.concurrencylimit || 2; // Reduced from 3 to 2 for better stability
    
    // Translation modules to try (in order of preference)
    const translationModules = ['google2', 'google', 'bing', 'libre'];
    let currentModuleIndex = 0;
    let currentModule = req.body.module || translationModules[0];
    
    const result = {};
    const translationStatus = {};

    // Process each language
    for (const lang of toLanguages) {
      let attempts = 0;
      let success = false;
      let bestTranslation = null;
      let bestCompleteness = 0;

      while (attempts < retryAttempts && !success) {
        attempts++;
        console.log(`🔄 Translating to ${lang} - Attempt ${attempts}/${retryAttempts} using ${currentModule}`);

        const command = `cd ${tempDir} && jsontt input.json --module ${currentModule} -f ${from} --to ${lang} --name ${name}_${lang}_${attempts} --fallback yes --concurrencylimit ${concurrencylimit}`;

        try {
          await new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
              if (error) {
                console.error(`❌ Translation attempt ${attempts} failed for ${lang}:`, error.message);
                reject(error);
                return;
              }

              const outputPath = path.join(tempDir, `${name}_${lang}_${attempts}.${lang}.json`);
              if (fs.existsSync(outputPath)) {
                const fileData = fs.readFileSync(outputPath, "utf8");
                const translatedData = JSON.parse(fileData);
                
                // Validate translation completeness
                const validation = validateTranslation(data, translatedData);
                console.log(`📊 Translation completeness for ${lang}: ${validation.completeness.toFixed(1)}%`);
                
                if (validation.completeness > bestCompleteness) {
                  bestTranslation = translatedData;
                  bestCompleteness = validation.completeness;
                }

                if (validation.completeness >= minimumCompleteness) {
                  success = true;
                  result[lang] = translatedData;
                  translationStatus[lang] = {
                    success: true,
                    completeness: validation.completeness,
                    attempts: attempts,
                    module: currentModule
                  };
                }
                
                resolve();
              } else {
                reject(new Error(`Output file not found: ${outputPath}`));
              }
            });
          });

          // Add delay between attempts to avoid rate limiting
          if (!success && attempts < retryAttempts) {
            console.log(`⏳ Waiting 2 seconds before next attempt for ${lang}...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Try next translation module if available
            if (attempts === Math.floor(retryAttempts / 2)) {
              currentModuleIndex = (currentModuleIndex + 1) % translationModules.length;
              currentModule = translationModules[currentModuleIndex];
              console.log(`🔄 Switching to translation module: ${currentModule}`);
            }
          }

        } catch (attemptError) {
          console.error(`❌ Attempt ${attempts} failed for ${lang}:`, attemptError.message);
          
          // If this was the last attempt and we have a partial translation, use it
          if (attempts === retryAttempts && bestTranslation && bestCompleteness > 50) {
            console.log(`⚠️ Using best partial translation for ${lang} (${bestCompleteness.toFixed(1)}% complete)`);
            result[lang] = bestTranslation;
            translationStatus[lang] = {
              success: false,
              completeness: bestCompleteness,
              attempts: attempts,
              module: currentModule,
              warning: "Partial translation used"
            };
            success = true; // Mark as handled
          }
        }
      }

      if (!success && !result[lang]) {
        console.error(`❌ Failed to translate to ${lang} after ${retryAttempts} attempts`);
        translationStatus[lang] = {
          success: false,
          completeness: 0,
          attempts: attempts,
          module: currentModule,
          error: "Translation failed completely"
        };
      }
    }

    // Prepare response
    const overallSuccess = Object.keys(result).length > 0;
    const responseData = {
      message: overallSuccess ? "✅ Translation completed" : "❌ Translation failed",
      output: result,
      translationStatus: translationStatus,
      summary: {
        totalLanguages: toLanguages.length,
        successfulTranslations: Object.keys(result).length,
        failedTranslations: toLanguages.length - Object.keys(result).length,
        averageCompleteness: Object.values(translationStatus).reduce((sum, status) => sum + (status.completeness || 0), 0) / toLanguages.length
      }
    };

    if (overallSuccess) {
      res.json(responseData);
    } else {
      res.status(207).json(responseData); // 207 Multi-Status for partial success
    }

  } catch (error) {
    console.error("Translation error:", error);
    res.status(500).json({ 
      error: "Translation failed", 
      details: error.message,
      suggestions: [
        "Try reducing concurrency limit (concurrencylimit: 1-2)",
        "Use different translation module (module: 'bing' or 'libre')",
        "Add delays between requests",
        "Consider using proxy list for Google Translate"
      ]
    });
  } finally {
    // Cleanup
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

// New endpoint for testing translation modules
app.post("/test-modules", async (req, res) => {
  const { data, testLanguage = 'es' } = req.body;
  
  if (!data) {
    return res.status(400).json({ error: "Provide 'data' to test translation modules." });
  }

  const id = uuidv4();
  const tempDir = path.join("/tmp", `test-${id}`);
  fs.mkdirSync(tempDir);

  const inputFilePath = path.join(tempDir, "test.json");
  fs.writeFileSync(inputFilePath, JSON.stringify(data, null, 2));

  const modules = ['google2', 'google', 'bing', 'libre'];
  const results = {};

  for (const module of modules) {
    try {
      const command = `cd ${tempDir} && jsontt test.json --module ${module} -f auto --to ${testLanguage} --name test_${module} --fallback no --concurrencylimit 1`;
      
      await new Promise((resolve, reject) => {
        exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
          if (error) {
            results[module] = { success: false, error: error.message };
            resolve();
            return;
          }

          const outputPath = path.join(tempDir, `test_${module}.${testLanguage}.json`);
          if (fs.existsSync(outputPath)) {
            const fileData = fs.readFileSync(outputPath, "utf8");
            const translatedData = JSON.parse(fileData);
            const validation = validateTranslation(data, translatedData);
            
            results[module] = {
              success: true,
              completeness: validation.completeness,
              sampleTranslation: Object.keys(translatedData)[0] ? 
                { [Object.keys(translatedData)[0]]: translatedData[Object.keys(translatedData)[0]] } : {}
            };
          } else {
            results[module] = { success: false, error: "Output file not created" };
          }
          resolve();
        });
      });

    } catch (error) {
      results[module] = { success: false, error: error.message };
    }
  }

  // Cleanup
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  res.json({
    message: "Translation module test completed",
    results: results,
    recommendation: Object.keys(results).find(module => 
      results[module].success && results[module].completeness >= 95
    ) || "Consider using proxy or paid translation service"
  });
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
  console.log(`📖 Available endpoints:`);
  console.log(`   POST /translate-multiple - Enhanced translation with retry logic`);
  console.log(`   POST /test-modules - Test which translation modules work best`);
});




// const express = require("express");
// const bodyParser = require("body-parser");
// const translator = require("@parvineyvazov/json-translator");
// const { exec } = require("child_process");
// const fs = require("fs");
// const path = require("path");
// const { v4: uuidv4 } = require("uuid");

// const app = express();  
// const port = 3000;

// app.use(bodyParser.json());

// app.post("/translate-multiple", async (req, res) => {
//   const { data, toLanguages } = req.body;

//   if (!data || !Array.isArray(toLanguages) || toLanguages.length === 0) {
//     return res.status(400).json({ error: "Provide 'data' and 'toLanguages' array (ISO codes)." });
//   }

//   const id = uuidv4(); // unique ID for this request
//   const tempDir = path.join("/tmp", `translate-${id}`);
//   fs.mkdirSync(tempDir);

//   try {
//     const inputFilePath = path.join(tempDir, "input.json");
//     fs.writeFileSync(inputFilePath, JSON.stringify(data, null, 2));

//     const from = req.body.from || 'auto';
//     const name = `myApp-${id}`; // unique name for output files
//     const concurrencylimit = req.body.concurrencylimit || 3;
//     const command = `cd ${tempDir} && jsontt input.json --module google2 -f ${from} --to ${toLanguages.join(' ')} --name ${name} --fallback no --concurrencylimit ${concurrencylimit}`;

//     exec(command, (error, stdout, stderr) => {
//       if (error) {
//         console.error(`❌ exec error: ${error}`);
//         return res.status(500).json({ error: "Command execution failed", details: error.message });
//       }

//       const result = {};
//       toLanguages.forEach((lang) => {
//         const outputPath = path.join(tempDir, `${name}.${lang}.json`);
//         if (fs.existsSync(outputPath)) {
//           const fileData = fs.readFileSync(outputPath, "utf8");
//           result[lang] = JSON.parse(fileData);
//         }
//       });

//       res.json({
//         message: "✅ Command executed successfully and files created.",
//         output: result,
//       });

//       // Cleanup
//       fs.rmSync(tempDir, { recursive: true, force: true });
//     });

//   } catch (error) {
//     console.error("Translation error:", error);
//     res.status(500).json({ error: "Translation failed", details: error.message });

//     // Cleanup on error
//     if (fs.existsSync(tempDir)) {
//       fs.rmSync(tempDir, { recursive: true, force: true });
//     }
//   }
// });

// app.listen(port, () => {
//   console.log(`✅ Server running at http://localhost:${port}`);
// });


// 0ld below

// const express = require("express");
// const bodyParser = require("body-parser");
// const translator = require("@parvineyvazov/json-translator");
// const { exec } = require("child_process");
// const fs = require("fs");
// const path = require("path");


// const app = express();
// const port = 3000;

// app.use(bodyParser.json());

// app.post("/translate-multiple", async (req, res) => {
//   const { data, toLanguages } = req.body;

//   if (!data || !Array.isArray(toLanguages) || toLanguages.length === 0) {
//     return res.status(400).json({ error: "Provide 'data' and 'toLanguages' array (ISO codes)." });
//   }

//   try {

//     // Replace all the data in input.json with req.data
//     const inputFilePath = path.join(__dirname, "input.json");
//     fs.writeFileSync(inputFilePath, JSON.stringify(data, null, 2));
//     console.log("✅ input.json updated with new data.");


//     const file = 'input.json';
//     const from = req.body.from || 'auto';
//     const to = toLanguages;
//     const name = 'myApp';
//     const concurrencylimit = req.body.concurrencylimit || 3;

//     const command = `jsontt ${file} --module google2 -f ${from} --to ${to.join(' ')} --name ${name} --fallback no --concurrencylimit ${concurrencylimit}`;

//     // const command = `jsontt ko.json --module google2 -f en --to ${toLanguages} --name myApp --fallback no --concurrencylimit 3`;

//     exec(command, (error, stdout, stderr) => {
//       if (error) {
//         console.error(`❌ exec error: ${error}`);
//         return res.status(500).json({ error: "Command execution failed", details: error.message });
//       }

//       if (stderr) {
//         console.warn(`⚠️ stderr: ${stderr}`);
//       }
//       const outputFiles = toLanguages.map(lang => `${name}.${lang}.json`);
//       const result = {};
//       outputFiles.forEach((file, index) => {
//         const filePath = path.join(__dirname, file);
//         if (fs.existsSync(filePath)) {
//           const fileData = fs.readFileSync(filePath, "utf8");
//           result[toLanguages[index]] = JSON.parse(fileData);
//         } else {
//           console.warn(`⚠️ File not found: ${filePath}`);
//         }
//       }
//       );
//       res.json({
//         message: "✅ Command executed successfully and files created.",
//         output: result,
//       });

//       // Delete the input and output files after sending the response 
//       fs.unlinkSync(inputFilePath);
//       outputFiles.forEach(file => {
//         const filePath = path.join(__dirname, file);
//         if (fs.existsSync(filePath)) {
//           fs.unlinkSync(filePath);
//           console.log(`✅ Deleted file: ${filePath}`);
//         }
//       }
//       );
//     });


//   } catch (error) {
//     console.error("Translation error:", error);
//     res.status(500).json({ error: "Translation failed", details: error.message });
//   }
// });

// app.listen(port, () => {
//   console.log(`✅ Server running at http://localhost:${port}`);
// });