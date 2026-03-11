const { spawn } = require("child_process");

function runMT5() {

    return new Promise((resolve, reject) => {

        const process = spawn("python", ["download_mt5.py"]);

        process.stdout.on("data", (data) => {
            console.log(data.toString());
        });

        process.stderr.on("data", (data) => {
            console.error(data.toString());
        });

        process.on("close", (code) => {

            if (code === 0) {
                resolve("Download finished");
            } else {
                reject("MT5 script failed");
            }

        });

    });

}


(async () => {

    try {

        const result = await runMT5();
        console.log(result);

    } catch (e) {

        console.error("Error:", e);

    }

})();