"use client";

import { createContext } from "react";
import GithubSlugger from "github-slugger";

export const RuntimeHeadingSluggerContext = createContext<GithubSlugger | null>(null);
