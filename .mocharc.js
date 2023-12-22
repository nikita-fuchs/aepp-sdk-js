module.exports = {
  require: 'tooling/babel-register.js',
  recursive: true,
  extension: '.js,.ts',
  timeout: [undefined, 'ae_devnet'].includes(process.env.NETWORK_ID) ? '40s' : '300s',
  ignore: 'test/environment/**',
  exit: true // TODO: fix in state channel tests
}
