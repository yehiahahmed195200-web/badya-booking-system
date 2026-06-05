const { exec } = require('child_process');

console.log("Listing all node.exe processes:");

exec('wmic process where "name=\'node.exe\'" get CommandLine,ProcessId', (err, stdout, stderr) => {
  if (err) {
    console.error("Failed to query processes:", err);
    return;
  }
  console.log(stdout);
});
