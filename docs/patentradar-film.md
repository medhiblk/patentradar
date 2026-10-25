# Silent PatentRadar landing walkthrough

The homepage includes a 65-second, seven-chapter visual introduction to PatentRadar. It is intentionally silent so the presenter can record the actual product and supply their own spoken commentary. There is no voice option, browser speech, audio playback, generated narration, music or soundscape.

The existing FormaProof identity, engineering hero, research workflows and navigation are preserved. Both research CTAs open the real invention-analysis flow without automatically running a search or sharing data.

## Storyboard

| Time | Chapter | Visual |
| --- | --- | --- |
| 0–9 | The question | Isometric cooling assembly, technical callouts and illustrative patent fragments. |
| 9–17 | Meet PatentRadar | Radar pulse filters fragments; the wordmark emerges. |
| 17–28 | Your invention | Product-style analysis window introduces an idea, PDF, known context, technical concepts and search strategy. |
| 28–40 | Discover | Jurisdiction network and multilingual concepts lead to clearly illustrative patent cards. |
| 40–51 | Understand | Side-by-side feature and claim comparison highlights concepts that warrant source review. |
| 51–58 | Stay ahead | Publication timeline, competitor and technology watches, personalized update. |
| 58–65 | Explore | PatentRadar signature and direct invention-research CTA. |

The chapter text and timings live in `apps/web/src/components/patent-film/story.json`. The complete text is also available in the homepage’s expandable walkthrough.

## Playback and implementation

`PatentFilm` owns the visual clock, transport and lifecycle. `FilmVisual` renders the seven SVG/CSS compositions. No video framework or new dependency is required. The film performs no research or media requests and does not load CAD/WASM.

- Visual autoplay only when visible and when reduced-motion, data-saving and 2G preferences allow it. Playback stops at 65 seconds without looping.
- Play/pause, replay, keyboard-native scrubber, chapter selection and optional text captions.
- Pause/resume continues from the exact position. Chapter selection and scrubbing pause for inspection while the presenter comments.
- Offscreen and hidden tabs pause; leaving the homepage cancels the animation clock.
- Reduced motion shows a completed still for each selected chapter. The server-rendered opening illustration also serves as the slow-connection/no-JavaScript fallback.
- Reserved scene and caption dimensions avoid layout changes between chapters. Scoped styles preserve the existing application theme.
- Example companies, identifiers, claims and charts are explicitly illustrative, never presented as live research results. Technical intelligence is not legal clearance.

## Verification

The original visual implementation passed the production build, TypeScript, lint, timeline tests and both existing production navigation tests. Desktop/mobile Chromium checks covered transport, chapters, captions, the 65-second endpoint, offscreen pause, reduced-motion behavior, mobile overflow and the real research CTA.

The silent revision removes the entire audio implementation and generation tooling. Validation checks the absence of audio controls and browser audio/speech calls while exercising visual playback. Field Core Web Vitals and sustained frame rates on physical mobile devices have not been measured.
