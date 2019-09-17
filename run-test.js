let optionalNameOfTestToRun = process.argv[2]
require('./test.js').queue(true, optionalNameOfTestToRun)
