import { defineConfig } from "@block65/shared-config/oxlint";

export default defineConfig({
	groups: { vitest: "on" },

	rules: {
		// LogDescriptor.time is a Date in the public API, and Temporal is not yet
		// in Workers or Node 24
		"unicorn-unported/prefer-temporal": "off",
	},
});
