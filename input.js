const { log } = console 
const _l = require('lodash')  
const { strRight } = require('underscore.string') 

module.exports = (stack, ...params)  => {

  let options = params.find(param => typeof param === 'object' && 
    param !== null && !Array.isArray(param))
  if(!options) options = {} 

  if(!params) {
    params = ['click', 'dblclick', 'keydown', 'keyup', 'link'] 
  }

  if(_l.includes(params, 'click') || _l.includes(params, 'link')) {

    document.body.addEventListener('click', async e => {

      if(params.includes('click')) {
        await stack.fire('click', e) 
      }
      

      if(!_l.includes(params, 'link')) return 

      const link = e.target.closest('a') 
      if (link) {
        const pathname = decodeURIComponent(link.pathname) 
        //^ convert any URL enncoded spaces to normal spaces
        const { basename='' } = options 
        if(pathname.search(basename) > -1) {
          const strippedLink = strRight(pathname, basename + '/')
          e.stopPropagation()
          e.preventDefault()
          e.stopImmediatePropagation()

          await stack.fire(strippedLink, e)        
        }
      }
    }) 
    
  }

  if(_l.includes(params, 'dblclick')) {
    document.body.addEventListener('dblclick', async e => 
      await stack.fire('dblclick', e) 
    ) 
  }

  if(_l.includes(params, 'keydown')) {
    document.addEventListener('keydown', async e => {
      await stack.fire('keydown/' + e.key, e) 
    }) 
  }

  if(_l.includes(params, 'keyup')) {
    document.addEventListener('keyup', async e =>
      await stack.fire('keyup/' + e.key, e) 
    )  
  }
}
