# Guided PDF-to-CAD demo

Open https://patentradar-puce.vercel.app/demo or select **Guided demo** in the More menu.

1. Select **Try the example document**. The source is a clearly marked synthetic PDF shipped in `public/examples/mechanical-assembly.pdf`; it is also downloadable.
2. Select **Read document & identify parts**. Local interpretation extracts the actual measured plate from that PDF; no account or OpenAI key is required for this sample.
3. Review the dimensions and select **Rebuild CAD**. OpenCascade computes a real solid in the browser. The source plate is 80 × 50 × 6 mm, volume 24,000 mm³.
4. Change width to 55 mm, rebuild, then export STEP or STL. The STEP contains genuine ISO-10303-21 geometry, not a saved screenshot.
5. Optionally select **Review features for patent research**. Review the extracted concepts and consent before public-provider queries. No sample patent or novelty/clearance result is invented.

The demo uses the same Studio as user projects; the sample is synthetic, its geometry is computed. Restart resets only the example component instance. Existing private design-return drafts are not restored into the example. Private files are not loaded unless the user explicitly opens and uses their private project.

Automated browser coverage: `tests/e2e/demo.spec.ts` checks source loading, dimensions, computed volume, editing, actual STEP bytes, mobile overflow and zero automatic patent/AI research calls. Existing engineering tests separately cover the research handoff and design iteration.
