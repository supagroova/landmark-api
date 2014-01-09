var modules = require('./app');
var app     = modules.app;
var config  = modules.config;
var workers = parseInt(process.env.WORKERS || require('os').cpus().length);
var cluster = require('cluster');

// Nodetime profiling
if (process.env.NODETIME_KEY) {
  require('nodetime').profile({
      accountKey: process.env.NODETIME_KEY, 
      appName: 'Landmark App API'
    });
}

if (cluster.isMaster && workers > 1) {
  // Fork workers.
  for (var i = 0; i < workers; i++) {
    cluster.fork();
  }

  cluster.on('exit', function(worker, code, signal) {
    console.log("Landmark Api Worker " + worker.id + " with pid:" + worker.process.pid + " died");
  });
  
  cluster.on('listening', function(worker, address) {
    console.log("Landmark Api Worker " + worker.id + " is now connected to " + address.address + ":" + address.port);
  });

} else {

  // listen
  app.listen(config.app.port);
  console.log("Landmark Api at your service. http://localhost:"+config.app.port);

}