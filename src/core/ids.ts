import { z } from "zod";

/** Ids of scenarios and calibration cases: lowercase words separated by hyphens. */
export const idSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "use lowercase words separated by hyphens");
