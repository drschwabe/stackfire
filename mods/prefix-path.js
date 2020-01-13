module.exports = path => path.substr(0, 1) != '/' ? '/' + path : path
