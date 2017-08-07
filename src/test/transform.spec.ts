import * as fs from "fs";
import * as kt from "karma-typescript/src/api/transforms";
import * as log4js from "log4js";
import * as path from "path";
import * as sinon from "sinon";
import * as test from "tape";
import * as ts from "typescript";

import * as transform from "../transform";

let logOptions: kt.TransformInitializeLogOptions = {
    appenders: [{
        layout: {
            pattern: "%[%d{DATE}:%p [%c]: %]%m",
            type: "pattern"
        },
        type: "console"
    }],
    level: "INFO"
};

let mockLogger = {
    debug: sinon.spy()
};

let getLoggerSpy = sinon.stub(log4js, "getLogger").returns(mockLogger);
let setGlobalLogLevelSpy = sinon.spy(log4js, "setGlobalLogLevel");
let configureSpy = sinon.spy(log4js, "configure");

transform.initialize(logOptions);

let compile = (filename: string): ts.SourceFile => {
    let options: ts.CompilerOptions = {
        experimentalDecorators: true,
        lib: [
            "lib.dom.d.ts",
            "lib.es5.d.ts",
            "lib.es2015.d.ts",
            "lib.scripthost.d.ts"
        ]
    };
    let host = ts.createCompilerHost(options);
    let program = ts.createProgram([filename], options, host);
    // tslint:disable-next-line: no-console
    console.log(ts.formatDiagnostics(ts.getPreEmitDiagnostics(program), host));
    return program.getSourceFile(filename);
};

let filename = path.join(process.cwd(), "./src/test/mock-component.ts");
let ast = compile(filename);

// kt.TransformContext...
let createContext = (): any => {
    return {
        config: {
            karma: {
                basePath: process.cwd(),
                urlRoot: "/custom-root/"
            }
        },
        filename,
        module: filename,
        source: fs.readFileSync(filename).toString(),
        ts: {
            ast,
            version: ts.version
        }
    };
};

test("transformer should initialize log level", (t) => {
    t.isEqual(setGlobalLogLevelSpy.args[0][0], logOptions.level);
    t.end();
});

test("transformer should initialize log appenders", (t) => {
    t.deepEqual(configureSpy.args[0][0], { appenders: logOptions.appenders });
    t.end();
});

test("transformer should initialize log category", (t) => {
    t.deepEqual(getLoggerSpy.args[0][0], "angular2-transform.karma-typescript");
    t.end();
});

test("transformer should check ts property", (t) => {

    t.plan(1);

    let context = createContext();
    context.ts = undefined;

    transform(context, (error: Error, dirty: boolean) => {
        if (error) {
            t.fail();
        }
        else {
            t.false(dirty);
        }
    });
});

test("transformer should check Typescript version", (t) => {

    t.plan(2);

    let context = createContext();
    context.ts.version = "0.0.0";

    transform(context, (error: Error, dirty: boolean) => {
        if (error) {
            t.equal("Typescript version of karma-typescript (0.0.0) does not match " +
                    "karma-typescript-angular2-transform Typescript version (" + ts.version + ")", error.message);
            t.false(dirty);
        }
        else {
            t.fail();
        }
    });
});

test("transformer should set dirty flag to true", (t) => {

    t.plan(1);

    let context = createContext();

    transform(context, (error: Error, dirty: boolean) => {
        if (error) {
            t.fail();
        }
        t.assert(dirty);
    });
});

test("transformer should transform template url", (t) => {

    t.plan(1);

    let context = createContext();

    transform(context, () => {
        t.assert(context.source.indexOf("templateUrl: \"/custom-root/base/src/test/mock.html\"") > 0);
    });
});

test("transformer should transform style urls", (t) => {

    t.plan(1);

    let context = createContext();

    transform(context, () => {
        t.assert(context.source.indexOf("styleUrls: " +
            "[\"/custom-root/base/src/test/style.css\", " +
            "\"/custom-root/base/src/test/style.less\", " +
            "\"/custom-root/base/src/style.scss\"]") > 0);
    });
});

test("transformer should log activity with level debug", (t) => {

    t.plan(1);

    let context = createContext();

    transform(context, () => {
        t.deepEqual(mockLogger.debug.lastCall.args, [
            "Rewriting %s to %s in %s",
            "mock.html",
            path.normalize("/custom-root/base/src/test/mock.html"),
            path.join(process.cwd(), "/src/test/mock-component.ts")
        ]);
    });
});

test("transformer should skip files without the properties 'templateUrl' and/or 'styleUrls'", (t) => {

    t.plan(1);

    filename = path.join(process.cwd(), "./src/test/mock-service.ts");
    ast = compile(filename);

    let context = createContext();

    transform(context, (error, dirty) => {
        if (error) {
            t.fail();
        }
        t.false(dirty);
    });
});

test("transformer should transform template url when defined with a template literal", (t) => {

    t.plan(1);

    filename = path.join(process.cwd(), "./src/test/another-mock-component.ts");
    ast = compile(filename);

    let context = createContext();

    transform(context, () => {
        t.assert(context.source.indexOf("templateUrl: `/custom-root/base/src/test/mock.html`") > 0);
    });
});

test("transformer should transform style urls when defined with template literals", (t) => {

    t.plan(1);

    filename = path.join(process.cwd(), "./src/test/another-mock-component.ts");
    ast = compile(filename);

    let context = createContext();

    transform(context, () => {
        t.assert(context.source.indexOf("styleUrls: " +
            "[`/custom-root/base/src/test/style.css`, " +
            "`/custom-root/base/src/test/style.less`, " +
            "`/custom-root/base/src/style.scss`]") > 0);
    });
});
