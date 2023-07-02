const { log } = console 
const _l = require('lodash')  

module.exports = (stack, ...params)  => {

  if(!params) {
    params = ['click', 'dblclick', 'keydown', 'keyup'] 
  }

  if(_l.includes(params, 'click')) {
    document.body.addEventListener('click', e => 
      stack.fire('click', e) 
    ) 
  }

  if(_l.includes(params, 'dblclick')) {
    document.body.addEventListener('dblclick', e => 
      stack.fire('dblclick', e) 
    ) 
  }

  if(_l.includes(params, 'keydown')) {
    document.addEventListener('keydown', e => {
      stack.fire('keydown/' + e.key, e) 
    }) 
  }

  if(_l.includes(params, 'keyup')) {
    document.addEventListener('keyup', e =>
      stack.fire('keyup/' + e.key, e) 
    )  
  }
}
