load("@npm//jest:index.bzl", "jest", _jest_test = "jest_test")

def dict_union(x, y):
    z = {}
    z.update(x)
    z.update(y)
    return z

def jest_test(name, srcs, deps, size = "medium", jest_config = "//:jest.config.js", snapshots = [], flaky = False, additional_args = [], env = {}, **kwargs):
    """A macro around the autogenerated jest and jest_test rules.

    Args:
        name: target name
        srcs: list of tests
        deps: src and npm deps to run the tests

        size: test size
        snapshots: snapshot files
        jest_config: jest.config.js file
        flaky: Whether this test is flaky
        additional_args: Any additional args for Jest
        env: Any environment variables for Jest
        **kwargs: the rest
    """

    templated_args = [
        "--config=%s" % "$(rootpath %s)" % jest_config,

        "--no-cache",
        "--ci",
        "--colors",
        "--runInBand",
        "--verbose",

        # '--detectOpenHandles',
        # '--forceExit',

        # bazel support
        "--no-watchman",
        "--haste={\\\"enableSymlinks\\\":true}",
    ] + additional_args

    data = [jest_config] + srcs + snapshots + deps + [
        "//:package.json",
        "//:jest-setup.cjs",
        "//tools:jest-reporter.cjs",
        "//tools:jest-log-serializer.cjs",
    ]

    env_with_defaults = dict_union(env, {
        "NODE_OPTIONS": "\"--experimental-vm-modules --trace-warnings %s\"" % env.get("NODE_OPTIONS"),
    })

    _jest_test(
        name = name,
        data = data,
        env = env_with_defaults,
        templated_args = templated_args,
        size = size,
        flaky = flaky,
        **kwargs
    )

    # This target is used to update the snapshot
    # e.g bazel run //packages/pkg-name:unit.update
    jest(
        name = "%s.update" % name,
        data = data,
        env = env_with_defaults,
        templated_args = templated_args + ["--updateSnapshot"],
        **kwargs
    )
