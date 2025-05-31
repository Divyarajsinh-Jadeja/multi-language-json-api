const express = require("express");
const bodyParser = require("body-parser");
const translator = require("@parvineyvazov/json-translator");

const app = express();
const port = process.env.PORT || 3000; // Render.com compatibility

app.use(bodyParser.json());

// List of translation modules to try in order of preference
const TRANSLATION_MODULES = [
  "google2", // Primary module (fast and free)
  "libre",   // Fallback 1 (free, reliable)
  "bing",    // Fallback 2 (free, alternative)
];

app.post("/translate-multiple", async (req, res) => {
  const { data, toLanguages, from = "auto", concurrencylimit = 3 } = req.body;

  // Validate input
  if (!data || !Array.isArray(toLanguages) || toLanguages.length === 0) {
    return res.status(400).json({
      error: "Provide 'data' (JSON object) and 'toLanguages' array (ISO codes).",
    });
  }

  try {
    // Function to attempt translation with a specific module
    const tryTranslate = async (module) => {
      try {
        const translations = await translator.translateObject(data, from, toLanguages, {
          module,
          concurrencyLimit: concurrencylimit,
        });

        // Check for failed translations (e.g., "--")
        let hasFailed = false;
        translations.forEach((translation) => {
          if (JSON.stringify(translation).includes("--")) {
            hasFailed = true;
          }
        });

        return { success: !hasFailed, translations, module };
      } catch (error) {
        console.warn(`Module ${module} failed: ${error.message}`);
        return { success: false, translations: null, module };
      }
    };

    let resultTranslations = null;
    let usedModule = null;

    // Try each module in sequence until one succeeds
    for (const module of TRANSLATION_MODULES) {
      const attempt = await tryTranslate(module);
      if (attempt.success) {
        resultTranslations = attempt.translations;
        usedModule = module;
        break;
      }
    }

    // If no module succeeded, return an error
    if (!resultTranslations) {
      return res.status(500).json({
        error: "All translation modules failed.",
        details: "Tried modules: " + TRANSLATION_MODULES.join(", "),
      });
    }

    // Map translations to language codes
    const result = {};
    toLanguages.forEach((lang, index) => {
      result[lang] = resultTranslations[index];
    });

    // Success response with info about the module used
    res.json({
      message: `✅ Translations completed using ${usedModule} module.`,
      output: result,
    });
  } catch (error) {
    console.error("Translation error:", error);
    res.status(500).json({
      error: "Translation failed",
      details: error.message,
    });
  }
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});


// Tomorrow  Code Below

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


// 0ld below ******************

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