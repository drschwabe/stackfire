const logUtil = (event, details) => {
  if(!details.path) details.path = '' 
  if(details.path === 'frame' || details.path === '/frame') return 
  if(event === 'fire_started') { 
    log(`
##############################
#stack.fire('${details.path}')
-----------------------------`)  
  } 

  if(event === 'listener_invoked') {
    log(`-->stack.on('${details.path}')---------`) 
  } else if(event === 'fire_complete') {
    log(`
-->stack.f('${details.path}') completed. 
-----------------------------`) 
  }      
}

module.exports = () => 
  stack.utils.push(logUtil) 
