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

// Fast validation - only check if translation has content
function quickValidateTranslation(original, translated) {
  if (!translated || typeof translated !== 'object') return false;
  
  const originalKeys = Object.keys(original);
  const translatedKeys = Object.keys(translated);
  
  // Quick check: at least 80% of top-level keys should be present
  const matchingKeys = originalKeys.filter(key => translatedKeys.includes(key));
  const completeness = (matchingKeys.length / originalKeys.length) * 100;
  
  return completeness >= 80;
}

// Optimized single translation attempt
async function translateToLanguage(tempDir, inputFile, from, language, name, options = {}) {
  const concurrencylimit = options.concurrencylimit || 3;
  const module = options.module || 'google2';
  const timeout = options.timeout || 45000; // 45 seconds max per language
  
  return new Promise((resolve) => {
    const command = `cd ${tempDir} && timeout 45s jsontt ${inputFile} --module ${module} -f ${from} --to ${language} --name ${name} --fallback yes --concurrencylimit ${concurrencylimit}`;
    
    const startTime = Date.now();
    
    exec(command, { timeout }, (error, stdout, stderr) => {
      const duration = Date.now() - startTime;
      
      if (error) {
        console.log(`❌ ${language} failed in ${duration}ms: ${error.message.split('\n')[0]}`);
        resolve({ 
          language, 
          success: false, 
          error: error.message.split('\n')[0],
          duration 
        });
        return;
      }

      const outputPath = path.join(tempDir, `${name}.${language}.json`);
      if (fs.existsSync(outputPath)) {
        try {
          const fileData = fs.readFileSync(outputPath, "utf8");
          const translatedData = JSON.parse(fileData);
          
          console.log(`✅ ${language} completed in ${duration}ms`);
          resolve({ 
            language, 
            success: true, 
            data: translatedData,
            duration 
          });
        } catch (parseError) {
          console.log(`❌ ${language} parse error in ${duration}ms`);
          resolve({ 
            language, 
            success: false, 
            error: "JSON parse error",
            duration 
          });
        }
      } else {
        console.log(`❌ ${language} no output file in ${duration}ms`);
        resolve({ 
          language, 
          success: false, 
          error: "No output file created",
          duration 
        });
      }
    });
  });
}

// Fast parallel translation with immediate retry for failures
app.post("/translate-multiple", async (req, res) => {
  const startTime = Date.now();
  const { data, toLanguages } = req.body;

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
    const options = {
      concurrencylimit: req.body.concurrencylimit || 3,
      module: req.body.module || 'google2',
      timeout: 45000
    };

    console.log(`🚀 Starting parallel translation for ${toLanguages.length} languages...`);

    // Phase 1: Parallel translation attempts
    const firstAttemptPromises = toLanguages.map(lang => 
      translateToLanguage(tempDir, "input.json", from, lang, name, options)
    );

    const firstResults = await Promise.all(firstAttemptPromises);
    
    // Separate successful and failed translations
    const successful = firstResults.filter(r => r.success);
    const failed = firstResults.filter(r => !r.success);

    console.log(`📊 First attempt: ${successful.length}/${toLanguages.length} successful`);

    let retryResults = [];
    
    // Phase 2: Quick retry for failures (only if there are few failures)
    if (failed.length > 0 && failed.length <= Math.ceil(toLanguages.length * 0.3)) {
      console.log(`🔄 Quick retry for ${failed.length} failed languages...`);
      
      // Try with different module for failures
      const retryOptions = {
        ...options,
        module: options.module === 'google2' ? 'bing' : 'google2',
        concurrencylimit: Math.max(1, Math.floor(options.concurrencylimit / 2))
      };

      const retryPromises = failed.map(f => 
        translateToLanguage(tempDir, "input.json", from, f.language, `${name}_retry`, retryOptions)
      );

      retryResults = await Promise.all(retryPromises);
    }

    // Combine results
    const allResults = [...successful, ...retryResults.filter(r => r.success)];
    const finalFailed = failed.filter(f => 
      !retryResults.some(r => r.language === f.language && r.success)
    );

    // Prepare response
    const result = {};
    const translationStatus = {};
    
    allResults.forEach(r => {
      result[r.language] = r.data;
      translationStatus[r.language] = {
        success: true,
        duration: r.duration,
        module: r.retried ? retryOptions.module : options.module
      };
    });

    finalFailed.forEach(f => {
      translationStatus[f.language] = {
        success: false,
        error: f.error,
        duration: f.duration
      };
    });

    const totalDuration = Date.now() - startTime;
    const avgDuration = allResults.length > 0 ? 
      allResults.reduce((sum, r) => sum + r.duration, 0) / allResults.length : 0;

    const responseData = {
      message: allResults.length > 0 ? 
        `✅ Completed ${allResults.length}/${toLanguages.length} translations` : 
        "❌ All translations failed",
      output: result,
      performance: {
        totalDuration: `${totalDuration}ms`,
        averagePerLanguage: `${Math.round(avgDuration)}ms`,
        parallelEfficiency: `${Math.round((avgDuration / totalDuration) * toLanguages.length * 100)}%`
      },
      summary: {
        successful: allResults.length,
        failed: finalFailed.length,
        total: toLanguages.length,
        successRate: `${Math.round((allResults.length / toLanguages.length) * 100)}%`
      },
      failures: finalFailed.length > 0 ? finalFailed.map(f => ({
        language: f.language,
        error: f.error
      })) : undefined
    };

    console.log(`🏁 Translation completed in ${totalDuration}ms (${allResults.length}/${toLanguages.length} successful)`);

    if (allResults.length > 0) {
      res.json(responseData);
    } else {
      res.status(500).json(responseData);
    }

  } catch (error) {
    console.error("Translation error:", error);
    res.status(500).json({ 
      error: "Translation failed", 
      details: error.message,
      duration: `${Date.now() - startTime}ms`
    });
  } finally {
    // Cleanup
    setTimeout(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }, 1000); // Small delay to ensure all processes are done
  }
});

// Fast translation without retries (maximum speed)
app.post("/translate-fast", async (req, res) => {
  const startTime = Date.now();
  const { data, toLanguages } = req.body;

  if (!data || !Array.isArray(toLanguages) || toLanguages.length === 0) {
    return res.status(400).json({ error: "Provide 'data' and 'toLanguages' array (ISO codes)." });
  }

  const id = uuidv4();
  const tempDir = path.join("/tmp", `fast-${id}`);
  fs.mkdirSync(tempDir);

  try {
    const inputFilePath = path.join(tempDir, "input.json");
    fs.writeFileSync(inputFilePath, JSON.stringify(data, null, 2));

    const from = req.body.from || 'auto';
    const name = `fast-${id}`;
    const concurrencylimit = req.body.concurrencylimit || 5; // Higher for speed

    // Single command for all languages at once
    const command = `cd ${tempDir} && timeout 60s jsontt input.json --module google2 -f ${from} --to ${toLanguages.join(' ')} --name ${name} --fallback yes --concurrencylimit ${concurrencylimit}`;

    console.log(`🚀 Fast translation for ${toLanguages.length} languages...`);

    const result = await new Promise((resolve, reject) => {
      exec(command, { timeout: 60000 }, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }

        const translationResult = {};
        const status = {};

        toLanguages.forEach((lang) => {
          const outputPath = path.join(tempDir, `${name}.${lang}.json`);
          if (fs.existsSync(outputPath)) {
            try {
              const fileData = fs.readFileSync(outputPath, "utf8");
              translationResult[lang] = JSON.parse(fileData);
              status[lang] = { success: true };
            } catch (e) {
              status[lang] = { success: false, error: "Parse error" };
            }
          } else {
            status[lang] = { success: false, error: "File not created" };
          }
        });

        resolve({ translationResult, status });
      });
    });

    const totalDuration = Date.now() - startTime;
    const successCount = Object.values(result.status).filter(s => s.success).length;

    res.json({
      message: `⚡ Fast translation completed in ${totalDuration}ms`,
      output: result.translationResult,
      performance: {
        totalDuration: `${totalDuration}ms`,
        averagePerLanguage: `${Math.round(totalDuration / toLanguages.length)}ms`,
        mode: "fast-parallel"
      },
      summary: {
        successful: successCount,
        failed: toLanguages.length - successCount,
        total: toLanguages.length,
        successRate: `${Math.round((successCount / toLanguages.length) * 100)}%`
      }
    });

  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error("Fast translation error:", error);
    res.status(500).json({ 
      error: "Fast translation failed", 
      details: error.message,
      duration: `${totalDuration}ms`,
      suggestion: "Try /translate-multiple endpoint for more reliable results"
    });
  } finally {
    // Cleanup
    setTimeout(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }, 500);
  }
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
  console.log(`🚀 Endpoints:`);
  console.log(`   POST /translate-multiple - Balanced speed + reliability`);
  console.log(`   POST /translate-fast - Maximum speed, less reliable`);
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