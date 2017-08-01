module.exports = function (grunt) {
    grunt.initConfig({
        eslint: {
            options: {
                target: '.',
                configFile: './eslint-config.json',
                rulePaths: ['./lib/rules']
            }
        }
    });

    require('load-grunt-tasks')(grunt);

    grunt.registerTask('default', ['eslint']);
};