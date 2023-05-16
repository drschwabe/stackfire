const { log } = console 
const logUtil = (event, command, listener) => {
  if(command.command || command.listener) {
    command = command.command
    listener = command.listener 
    //todo: rename these params to make more sense
  }
  if(!command.path) command.path = '' 
  //if(command.path === 'frame' || command.path === '/frame') return 
  //todo^ blacklist feature 
  if(event === 'fire_started') { 
    log(`
##############################
#stack.fire('${command.path}')
-----------------------------`)  
  } 

 if(event === 'fire_branch') {
    log(`
#######-------------------------
#stack.branch('${command.path}')
-----------------------------`)  
  }

  if(event === 'fireQ_appended') {
    log(`
------------------------------
#command has been pushed to the fireQ: '${command.path}'
#(existing loop in progress) 
-----------------------------`)  
  }        

  if(event === 'listener_invoked') {
    log(`-->stack.on('${command.path}')---------`) 
  } else if(event === 'fire_complete') {
    log(`
-->stack.f('${command.path}') completed. 
-----------------------------############
`) 
  }      
}

module.exports = logUtil 

