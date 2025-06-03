const express = require("express");
const bodyParser = require("body-parser");
const translator = require("@parvineyvazov/json-translator");
const { default_concurrency_limit, default_fallback } = require("@parvineyvazov/json-translator");

const app = express();
const port = 3000;

app.use(bodyParser.json());

app.post("/translate-multiple", async (req, res) => {
    const { data, toLanguages } = req.body;
    const from = req.body.from || 'auto';
    
    console.log("🔄 Translation request received");
    console.log(`📊 Request details: from=${from}, toLanguages=${JSON.stringify(toLanguages)}, data keys count=${Object.keys(data || {}).length}`);

    // Input validation
    if (!data || !Array.isArray(toLanguages) || toLanguages.length === 0) {
        console.warn("⚠️  Validation failed: Invalid input parameters");
        console.warn(`   - data: ${data ? 'provided' : 'missing'}`);
        console.warn(`   - toLanguages: ${Array.isArray(toLanguages) ? `array with ${toLanguages.length} items` : 'not an array or missing'}`);
        return res.status(400).json({
            error: "Provide 'data' and 'toLanguages' array (ISO codes)."
        });
    }

    if (typeof data !== 'object') {
        console.warn("⚠️  Validation failed: 'data' must be an object");
        return res.status(400).json({
            error: "'data' must be an object with key-value pairs."
        });
    }

    console.log("✅ Input validation passed");

    try {
        const result = {};
        const totalLanguages = toLanguages.length;
        const totalKeys = Object.keys(data).length;
        
        console.log(`🚀 Starting translation process for ${totalLanguages} language(s) and ${totalKeys} key(s)`);

        for (let i = 0; i < toLanguages.length; i++) {
            const toLanguage = toLanguages[i];
            console.log(`\n🌍 Processing language ${i + 1}/${totalLanguages}: ${toLanguage}`);
            
            const translatedData = {};
            let translatedCount = 0;
            let skippedCount = 0;
            let errorCount = 0;

            for (const key in data) {
                if (data.hasOwnProperty(key)) {
                    const value = data[key];
                    
                    if (typeof value === 'string') {
                        console.log(`   🔤 Translating key: "${key}" (${translatedCount + 1}/${totalKeys})`);
                        
                        try {
                            const translatedValue = await translator.translateWord(value, from, toLanguage, {
                                moduleKey: 'google2',
                                TranslationModule: translator.TranslationModules['google2'],
                                concurrencyLimit: default_concurrency_limit,
                                fallback: default_fallback,
                            });
                            
                            translatedData[key] = translatedValue;
                            translatedCount++;
                            console.log(`   ✅ Successfully translated "${key}"`);
                            
                        } catch (error) {
                            console.error(`   ❌ Failed to translate key "${key}":`, error.message);
                            translatedData[key] = value; // Fallback to original value
                            errorCount++;
                        }
                    } else {
                        translatedData[key] = value; // Non-string values are copied as is
                        skippedCount++;
                        console.log(`   ⏭️  Skipped non-string key: "${key}" (type: ${typeof value})`);
                    }
                }
            }

            result[toLanguage] = translatedData;
            
            console.log(`📈 Language ${toLanguage} summary:`);
            console.log(`   - Translated: ${translatedCount} keys`);
            console.log(`   - Skipped: ${skippedCount} keys (non-string values)`);
            console.log(`   - Errors: ${errorCount} keys (fallback to original)`);
        }

        console.log("\n🎉 Translation process completed successfully");
        console.log(`📋 Final summary:`);
        console.log(`   - Languages processed: ${totalLanguages}`);
        console.log(`   - Total keys per language: ${totalKeys}`);
        console.log(`   - Response size: ${JSON.stringify(result).length} characters`);

        res.json({
            message: "✅ Translation completed successfully",
            output: result,
            summary: {
                languagesProcessed: totalLanguages,
                keysPerLanguage: totalKeys,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error("❌ Critical translation error:", error.message);
        console.error("🔍 Error stack:", error.stack);
        
        res.status(500).json({
            error: "Translation failed",
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Health check endpoint
app.get("/health", (req, res) => {
    console.log("🏥 Health check requested");
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Handle 404 for unknown routes
app.use("*", (req, res) => {
    console.warn(`⚠️  404 - Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        error: "Route not found",
        availableRoutes: [
            "POST /translate-multiple",
            "GET /health"
        ]
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error("💥 Unhandled server error:", error.message);
    console.error("🔍 Error stack:", error.stack);
    
    res.status(500).json({
        error: "Internal server error",
        timestamp: new Date().toISOString()
    });
});

app.listen(port, () => {
    console.log(`🚀 Translation server started successfully`);
    console.log(`📍 Server running at http://localhost:${port}`);
    console.log(`📋 Available endpoints:`);
    console.log(`   - POST /translate-multiple - Translate JSON data to multiple languages`);
    console.log(`   - GET /health - Health check`);
    console.log(`⏰ Server started at: ${new Date().toISOString()}`);
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