const express = require("express");
const bodyParser = require("body-parser");
const { v4: uuidv4 } = require("uuid");
const translator = require("@parvineyvazov/json-translator");
const {
    default_concurrency_limit,
    default_fallback,
} = require("@parvineyvazov/json-translator");

const app = express();
const port = 3000;

app.use(bodyParser.json());

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
        const result = {};

        console.log(`🆕 Received translation request`);
        console.log(`📦 Source language: ${from}`);
        console.log(`🌍 Target languages: ${toLanguages.join(', ')}`);
        console.log(`📄 Keys to translate: ${Object.keys(data).length}`);

        for (const toLanguage of toLanguages) {
            console.log(`\n🔁 Translating to: ${toLanguage}`);
            const entries = Object.entries(data).filter(([_, value]) => typeof value === 'string');

            const translatedEntriesSettled = await Promise.allSettled(
                entries.map(async ([key, value]) => {
                    console.log(`📝 Translating key: "${key}" => "${value}"`);
                    try {
                        const translatedValue = await translator.translateWord(value, from, toLanguage, {
                            moduleKey: 'google2',
                            TranslationModule: translator.TranslationModules['google2'],
                            concurrencyLimit: default_concurrency_limit,
                            fallback: default_fallback,
                        });
                        console.log(`✅ [${toLanguage}] ${key}: "${value}" → "${translatedValue}"`);
                        return [key, translatedValue];
                    } catch (error) {
                        console.error(`❌ Error translating key "${key}" to "${toLanguage}":`, error.message);
                        return [key, value]; // Fallback to original
                    }
                })
            );

            result[toLanguage] = Object.fromEntries(
                translatedEntriesSettled.map((res, i) =>
                    res.status === 'fulfilled' ? res.value : [entries[i][0], entries[i][1]]
                )
            );
        }

        console.log("✅ All translations completed successfully.");

        res.json({
            message: "✅ Translations completed successfully.",
            output: result,
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