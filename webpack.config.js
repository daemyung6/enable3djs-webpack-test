module.exports = {
    mode: 'development',
    entry: './src/index.js',
    output: {
        filename: 'bundle.js',
        path: __dirname + '/dist/',
    },
    devServer: {
        port: 9000,
        static: {
            directory:  __dirname + '/dist/',
        },
        client: {
            overlay: false,
        },
    }
};