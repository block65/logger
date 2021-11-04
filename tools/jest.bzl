load("@npm//jest:index.bzl", "jest", _jest_test = "jest_test")

def jest_test(name, srcs, deps, size = "medium", jest_config = "//:jest.config.cjs", snapshots = [], flaky = False, additional_args = [], **kwargs):
    """A macro around the autogenerated jest_test rule.

    Args:
        name: target name
        srcs: list of tests, srcs & snapshot files
        deps: npm deps
        size: test size
        snapshots: snapshot files
        jest_config: jest.config.cjs file, default to the root one
        flaky: Whether this test is flaky
        additional_args: Any addl args
        **kwargs: the rest
    """
    templated_args = [
        "--no-cache",
        "--no-watchman",
        "--ci",
        "--runInBand",
        "--colors",
    ] + additional_args
    templated_args.extend(["--config", "$(rootpath %s)" % jest_config])
    for src in srcs:
        templated_args.extend(["--runTestsByPath", "$(rootpath %s)" % src])

    data = [jest_config] + srcs + snapshots + deps + [
        "@npm//ts-jest",
        # "@npm//@types/jest",
        "//:tsconfig.json",
        "//tools:jest-reporter.cjs",
        "//:jest-setup.cjs",
    ]

    _jest_test(
        name = name,
        data = data,
        templated_args = templated_args,
        tags = [
            # Need to set the pwd to avoid jest needing a runfiles helper
            # Windows users with permissions can use --enable_runfiles
            # to make this test work
            "no-bazelci-windows",
            # TODO: why does this fail almost all the time, but pass on local Mac?
            "no-bazelci-mac",
        ],
        size = size,
        flaky = flaky,
        **kwargs
    )

    # This target is used to update the snapshot
    # e.g bazel run //packages/pkg-name:unit.update
    jest(
        name = "%s.update" % name,
        data = data,
        templated_args = templated_args + ["-u"],
        tags = [
            # Need to set the pwd to avoid jest needing a runfiles helper
            # Windows users with permissions can use --enable_runfiles
            # to make this test work
            "no-bazelci-windows",
            # TODO: why does this fail almost all the time, but pass on local Mac?
            "no-bazelci-mac",
        ],
        **kwargs
    )
