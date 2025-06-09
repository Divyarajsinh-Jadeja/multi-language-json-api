const express = require("express");
const bodyParser = require("body-parser");
const {exec} = require("child_process");
const fs = require("fs");
const path = require("path");
const {v4: uuidv4} = require("uuid");
const translator = require("@parvineyvazov/json-translator");
const {TranslationConfig: TranslationConfigTemp, default_concurrency_limit, default_fallback, TranslationModulesTemp} = require("@parvineyvazov/json-translator");

const app = express();
const port = 3000;

app.use(bodyParser.json());

// Increased concurrency limit for faster processing
const FAST_CONCURRENCY_LIMIT = 5; // Reduced to avoid rate limiting
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second delay between retries

// Helper function to retry translation
async function translateWithRetry(text, from, to, retries = MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const result = await translator.translateWord(text.trim(), from, to, {
                moduleKey: 'google2',
                TranslationModule: translator.TranslationModules['google2'],
                concurrencyLimit: FAST_CONCURRENCY_LIMIT,
                fallback: default_fallback,
            });
            
            // Validate translation result
            if (result && result.trim() && result !== '--' && result.toLowerCase() !== 'error') {
                return { success: true, translation: result.trim() };
            }
            
            console.log(`⚠️ Invalid translation result on attempt ${attempt}: "${result}"`);
            
            if (attempt < retries) {
                console.log(`🔄 Retrying in ${RETRY_DELAY}ms...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            }
            
        } catch (error) {
            console.error(`❌ Translation attempt ${attempt} failed:`, error.message);
            
            if (attempt < retries) {
                console.log(`🔄 Retrying in ${RETRY_DELAY}ms...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            }
        }
    }
    
    return { success: false, translation: null };
}

app.post("/translate-multiple", async (req, res) => {
    const { data, toLanguages } = req.body;
    
    if (!data || !Array.isArray(toLanguages) || toLanguages.length === 0) {
        console.warn("⚠️  Invalid input: 'data' or 'toLanguages' is missing or malformed.");
        return res.status(400).json({
            error: "Provide 'data' and 'toLanguages' array (ISO codes)."
        });
    }
    
    try {
        const from = req.body.from || 'auto';
        
        console.log(`🆕 Received translation request`);
        console.log(`📦 Source language: ${from}`);
        console.log(`🌍 Target languages: ${toLanguages.join(', ')}`);
        console.log(`📄 Keys to translate: ${Object.keys(data).length}`);
        
        // Get all string values that need translation (filter out empty/invalid strings)
        const stringEntries = Object.entries(data).filter(([key, value]) => 
            typeof value === 'string' && 
            value.trim().length > 0 && 
            value.trim() !== '--'
        );
        const nonStringEntries = Object.entries(data).filter(([key, value]) => 
            typeof value !== 'string' || 
            value.trim().length === 0 || 
            value.trim() === '--'
        );
        
        console.log(`📝 String keys to translate: ${stringEntries.length}`);
        console.log(`⏭️ Non-string keys to copy: ${nonStringEntries.length}`);
        
        // Create all translation promises at once for maximum parallelization
        const translationPromises = [];
        
        for (const toLanguage of toLanguages) {
            for (const [key, value] of stringEntries) {
                translationPromises.push(
                    translateWithRetry(value, from, toLanguage)
                    .then(result => ({
                        toLanguage,
                        key,
                        originalValue: value,
                        translatedValue: result.translation,
                        success: result.success
                    }))
                );
            }
        }
        
        console.log(`🚀 Starting ${translationPromises.length} parallel translations...`);
        const startTime = Date.now();
        
        // Execute all translations in parallel
        const translationResults = await Promise.all(translationPromises);
        
        const endTime = Date.now();
        console.log(`⚡ All translations completed in ${endTime - startTime}ms`);
        
        // Organize results by language
        const result = {};
        
        // Initialize result structure
        for (const toLanguage of toLanguages) {
            result[toLanguage] = {};
            
            // Add non-string values first
            for (const [key, value] of nonStringEntries) {
                result[toLanguage][key] = value;
            }
        }
        
        // Add translated values and check for failures
        let successfulTranslations = 0;
        let failedTranslations = 0;
        const failedItems = [];
        
        for (const translationResult of translationResults) {
            const { toLanguage, key, translatedValue, success, originalValue } = translationResult;
            
            if (success && translatedValue) {
                result[toLanguage][key] = translatedValue;
                console.log(`✅ [${toLanguage}] ${key}: "${originalValue}" → "${translatedValue}"`);
                successfulTranslations++;
            } else {
                failedTranslations++;
                failedItems.push({ key, originalValue, toLanguage });
                console.error(`❌ [${toLanguage}] Failed to translate "${key}": "${originalValue}"`);
            }
        }
        
        // If any translations failed, return error
        if (failedTranslations > 0) {
            console.error(`❌ ${failedTranslations} translations failed. Returning error.`);
            return res.status(500).json({
                error: "Some translations failed",
                message: `${failedTranslations} out of ${translationPromises.length} translations failed`,
                failedItems: failedItems,
                stats: {
                    totalTranslations: translationPromises.length,
                    successfulTranslations,
                    failedTranslations,
                    processingTimeMs: endTime - startTime
                }
            });
        }
        
        console.log(`✅ All ${successfulTranslations} translations completed successfully!`);
        
        res.json({
            message: "✅ All translations completed successfully",
            output: result,
            stats: {
                totalTranslations: translationPromises.length,
                successfulTranslations,
                failedTranslations: 0,
                processingTimeMs: endTime - startTime,
                languages: toLanguages.length,
                keys: Object.keys(data).length
            }
        });
        
    } catch (error) {
        console.error("❌ Translation error:", error.message);
        res.status(500).json({
            error: "Translation failed",
            details: error.message
        });
    }
});

app.listen(port, () => {
    console.log(`✅ Server running at http://localhost:${port}`);
});

/// My Code

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
//     console.warn("⚠️  Invalid input: 'data' or 'toLanguages' is missing or malformed.");
//     return res.status(400).json({ error: "Provide 'data' and 'toLanguages' array (ISO codes)." });
//   }

//   const id = uuidv4();
//   const tempDir = path.join("/tmp", `translate-${id}`);
//   fs.mkdirSync(tempDir);
//   console.log(`📁 Temporary directory created: ${tempDir}`);

//   try {
//     const inputFilePath = path.join(tempDir, "input.json");
//     fs.writeFileSync(inputFilePath, JSON.stringify(data, null, 2));
//     console.log(`📄 Input JSON file created at: ${inputFilePath}`);

//     const from = req.body.from || 'auto';
//     const name = `myApp-${id}`;
//     const concurrencylimit = req.body.concurrencylimit || 3;
//     const command = `cd ${tempDir} && jsontt input.json --module google2 -f ${from} --to ${toLanguages.join(' ')} --name ${name} --fallback yes --concurrencylimit ${concurrencylimit}`;
    
//     console.log(`🚀 Executing translation command:\n${command}`);

//     exec(command, (error, stdout, stderr) => {
//       if (error) {
//         console.error(`❌ Command execution error: ${error.message}`);
//         return res.status(500).json({ error: "Command execution failed", details: error.message });
//       }

//       console.log("✅ Translation command executed successfully.");
//       console.log(`📤 stdout:\n${stdout}`);
//       if (stderr) console.warn(`⚠️ stderr:\n${stderr}`);

//       const result = {};
//       toLanguages.forEach((lang) => {
//         const outputPath = path.join(tempDir, `${name}.${lang}.json`);
//         if (fs.existsSync(outputPath)) {
//           const fileData = fs.readFileSync(outputPath, "utf8");
//           result[lang] = JSON.parse(fileData);
//           console.log(`📄 Output for ${lang} loaded from ${outputPath}`);
//         } else {
//           console.warn(`⚠️ Output file not found for language: ${lang}`);
//         }
//       });

//       res.json({
//         message: "✅ Command executed successfully and files created.",
//         output: result,
//       });

//       fs.rmSync(tempDir, { recursive: true, force: true });
//       console.log(`🧹 Temporary directory cleaned up: ${tempDir}`);
//     });

//   } catch (error) {
//     console.error("❌ Translation error:", error);
//     res.status(500).json({ error: "Translation failed", details: error.message });

//     if (fs.existsSync(tempDir)) {
//       fs.rmSync(tempDir, { recursive: true, force: true });
//       console.log(`🧹 Temporary directory cleaned up after error: ${tempDir}`);
//     }
//   }
// });

// app.listen(port, () => {
//   console.log(`✅ Server running at http://localhost:${port}`);
// });

/// Old Code


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