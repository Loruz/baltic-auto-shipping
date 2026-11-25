// Regenerates schema.dbml for dbdiagram.io:  pnpm db:dbml
import * as schema from "./schema.ts";
import { pgGenerate } from "drizzle-dbml-generator";

pgGenerate({ schema, out: "./schema.dbml", relational: false });
