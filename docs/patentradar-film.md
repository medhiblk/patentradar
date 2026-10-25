# PatentRadar landing film

A 65-second, seven-chapter explainer integrated at the top of the existing homepage. The current FormaProof brand, engineering hero, navigation, research consent flow and product routes remain intact. The film introduces PatentRadar as the patent intelligence experience inside this existing product; it does not rebrand the rest of the app.

## Creative direction and storyboard

Near-black navy, ice-cyan technical linework, restrained violet concept accents, generous typography and quiet editorial transitions. One fictional industrial cooling system provides continuity. The SVG assembly is an isometric illustration, not an actual CAD model. Lightweight document fragments suggest scale instead of mounting hundreds of expensive DOM cards.

| Time | Chapter | Composition and transition |
| --- | --- | --- |
| 0–9 | The question | Rotating isometric cooling assembly, technical callouts, orbiting patent fragments. “Millions of patents. One critical question.” |
| 9–17 | Meet PatentRadar | Radar pulse filters the fragments; the wordmark emerges over the assembly. |
| 17–28 | Your invention | Product-style analysis window types the cooling concept, adds a PDF and known context, extracts concepts and reveals a search strategy. |
| 28–40 | Discover | Jurisdiction network connects multilingual concepts. Two clearly fictional patent cards reveal title, identifier, applicant, jurisdiction, publication date and qualitative overlap. |
| 40–51 | Understand | Invention and illustrative claim sit side by side. Highlighted technical features lead to comparable concepts and source-review guidance. |
| 51–58 | Stay ahead | Publication trend, competitor and technology watches, then a personalized alert. |
| 58–65 | Explore | Radar signature, PatentRadar wordmark and direct invention-research CTA. “Before you build. Know what exists.” |

The final English narration lives in `src/components/patent-film/story.json`, which is shared by the player, transcript and generator. Read the full script in the homepage’s expandable transcript. The narration is condensed from the supplied brief to allow natural pauses within 65 seconds.

## Architecture and behavior

`PatentFilm` owns transport, audio, accessibility and lifecycle. `FilmVisual` renders seven deterministic scenes from the shared timeline. Component-scoped `pf-` CSS avoids existing theme selectors. There are no new dependencies, background research requests, external media requests or CAD/WASM loads for the film.

- Silent visual autoplay only when visible and when reduced-motion/data-saving/2G preferences allow it. No looping. Offscreen or hidden tabs pause.
- Play/pause, replay, sound toggle, keyboard-native scrubber, chapter buttons, captions and complete transcript. All buttons have accessible names and visible focus rings.
- Scrubbing and chapter selection pause for inspection. Browser-voice resume restarts the current chapter so a sentence is not resumed halfway through.
- Reduced motion renders a completed still for each chapter, with no animated transitions. Explicit play can still advance chapters and narration.
- Server-rendered first-scene illustration is the no-JavaScript/slow-connection poster. Reserved stage and caption dimensions avoid scene-induced layout shifts.
- Fixed 65-second timeline. Generated audio is the master clock, so loading or buffering stops visual progression. No narration assets load until sound is enabled.
- The browser speech fallback is chapter-cued, device-dependent, and deliberately labeled as a preview. It cannot guarantee studio-quality timing. Browsers without speech support retain captions and transcript.
- Original Web Audio sine tones provide a quiet ambient fifth, brief transition pulses and a three-note final signature. No third-party sound assets or licenses are needed. These remain off until a sound interaction and stop with playback/unmount.

## Generate the production voice

No narration was generated in the implementation environment: no OpenAI key was available. `public/patent-film/narration.json` deliberately records `available: false`.

1. Set `OPENAI_API_KEY` in the shell or the ignored `.env.local` file. Never put it in a `NEXT_PUBLIC_` variable.
2. Run `npm run film:narration` from the repository. This is an offline owner-run script, not a public API endpoint. It sends only the film script to OpenAI.
3. Listen to the complete generated file and review pacing. If a chapter exceeds its time slot, generation fails without publishing a replacement manifest; shorten that chapter and rerun.
4. Commit the content-hashed WAV and updated manifest, then rebuild. The player uses that WAV automatically and displays “AI-generated narration.”

The generator uses the project's existing OpenAI SDK, `gpt-4o-mini-tts`, the `cedar` voice, and 24 kHz / 16-bit mono PCM. It pads each chapter with silence and writes a 65-second WAV plus measured sentence cues. There is no audio truncation or pitch-changing time stretch. The output is approximately 3 MiB, loaded on demand.

Official API reference: https://developers.openai.com/api/docs/guides/text-to-speech

As checked on 2026-10-25, OpenAI marks Speech API TTS models deprecated with shutdown scheduled for 2027-01-06. This offline generator uses the still-supported Speech API compatible with the installed SDK. Migrate the generator to the documented Realtime replacement before that date if regenerating later. Previously generated static WAV assets remain independently playable.

## Data and scope

Every company, publication identifier, claim and chart in the film is illustrative. No live patent findings are fabricated. A persistent preview label and research limitation accompany the film. The primary CTA calls the existing `go("New Analysis")`; opening research does not execute searches or share invention data.

This is an interactive landing-page experience, not an exported MP4. It does not alter the existing research, alerts, CAD or backend behavior. Real 3D and a video framework were unnecessary for this lightweight SVG treatment.

## Verification completed

- Production build, TypeScript and ESLint passed.
- Timeline tests cover contiguous chapter boundaries, endpoint behavior and bounded scrubbing.
- Offline generator test uses a local mock provider to verify sentence cues, the 65-second WAV header and size, and rejection of oversized speech without replacing the previous manifest. No real speech-generation request was made.
- Desktop Chromium checks passed: clock advancement, pause, replay, all chapter seeks, caption toggle, sound toggle, keyboard seeking, stopping at 65 seconds and offscreen pause.
- Mobile Chromium at 390 px passed horizontal-overflow and reduced-motion checks; the final CTA opened the actual invention input.
- Both existing navigation regression tests passed against a production server, including the lightweight-home/no-API-or-WASM check and mobile Back/refresh behavior. The initial development-server run timed out during route loading; production verification passed without changing those tests.
- Desktop and mobile screenshots were visually inspected. Field Core Web Vitals, sustained 60 FPS on physical mobile devices, Safari audio behavior and a production narration listening review have not been measured or certified.
