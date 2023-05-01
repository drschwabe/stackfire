const { log } = console 
const logUtil = (event, command, listener) => {
  if(!command.path) command.path = '' 
  //if(command.path === 'frame' || command.path === '/frame') return 
  //todo^ blacklist feature 
  if(event === 'fire_started') { 
    log(`
##############################
#stack.fire('${command.path}')
-----------------------------`)  
  } 

  if(event === 'listener_invoked') {
    log(`-->stack.on('${command.path}')---------`) 
  } else if(event === 'fire_complete') {
    log(`
-->stack.f('${command.path}') completed. 
-----------------------------`) 
  }      
}

module.exports = logUtil 

