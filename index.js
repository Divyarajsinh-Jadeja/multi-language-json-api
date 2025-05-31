const express = require("express");
const bodyParser = require("body-parser");
const { exec } = require("child_process");
const fs = require("fs").promises;
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const util = require("util");
const cors = require("cors");

const execPromise = util.promisify(exec);

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());

app.post("/translate-multiple", async (req, res) => {
  const { data, toLanguages, from, concurrencylimit } = req.body;

  // Validate input
  if (!data || !data.message || typeof data.message !== "string" || !Array.isArray(toLanguages) || toLanguages.length === 0) {
    return res.status(400).json({ error: "Provide 'data.message' (string) and 'toLanguages' array (ISO codes)." });
  }

  const validLangs = ["en", "ar", "fa", "ru", "de", "ko", "bn", "hi", "gu", "ta", "kn", "pt", "es", "iw", "ur", "it", "zh-TW", "ja"];
  if (!toLanguages.every(lang => validLangs.includes(lang)) || (from && from !== "auto" && !validLangs.includes(from))) {
    return res.status(400).json({ error: "Invalid language codes." });
  }

  const id = uuidv4();
  const tempDir = path.join("/tmp", `translate-${id}`);
  const logFile = path.join("/tmp", `translate-${id}.log`);

  try {
    await fs.mkdir(tempDir, { recursive: true });

    const inputFilePath = path.join(tempDir, "input.json");
    await fs.writeFile(inputFilePath, JSON.stringify(data, null, 2));

    const sourceLang = from || "auto";
    const name = `myApp-${id}`;
    const maxConcurrency = concurrencylimit || 2;
    const commandTimeout = 10000; // 10 seconds

    const result = {};

    const translateLanguage = async (lang) => {
      const outputPath = path.join(tempDir, `${name}.${lang}.json`);
      const command = `cd ${tempDir} && jsontt input.json --module google2 -f ${sourceLang} --to ${lang} --name ${name} --fallback no`;

      try {
        const { stdout, stderr } = await execPromise(command, { timeout: commandTimeout });
        await fs.appendFile(logFile, `[${lang}] stdout: ${stdout}\nstderr: ${stderr}\n`);

        if (await fs.access(outputPath).then(() => true).catch(() => false)) {
          const fileData = await fs.readFile(outputPath, "utf8");
          try {
            const parsedData = JSON.parse(fileData);
            result[lang] = { message: parsedData.message?.toString() || data.message };
          } catch (parseError) {
            console.error(`Invalid JSON for ${lang}: ${parseError.message}`);
            await fs.appendFile(logFile, `Parse error for ${lang}: ${parseError.message}\n`);
            result[lang] = { message: data.message };
          }
        } else {
          console.error(`No output file for ${lang}`);
          result[lang] = { message: data.message };
        }
      } catch (error) {
        console.error(`Command failed for ${lang}: ${error.message}`);
        await fs.appendFile(logFile, `Error for ${lang}: ${error.message}\n`);
        result[lang] = { message: data.message };
      }
    };

    // Parallelize translations in chunks
    const chunkSize = maxConcurrency;
    for (let i = 0; i < toLanguages.length; i += chunkSize) {
      const chunk = toLanguages.slice(i, i + chunkSize);
      await Promise.all(chunk.map(translateLanguage));
    }

    res.json({
      message: "Translation completed successfully",
      output: result,
    });

  } catch (error) {
    console.error("Translation error:", error);
    await fs.appendFile(logFile, `Global error: ${error.message}\n`);
    res.status(500).json({ error: "Translation failed", details: error.message });

  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch((err) => {
      console.error(`Cleanup failed: ${err.message}`);
    });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
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