#!/usr/bin/env node
import { runCli } from "../cli/run-cli.js";

const { code, output } = await runCli(process.argv.slice(2));
process.stdout.write(`${output}\n`);
process.exitCode = code;
