#include <metal_stdlib>
#include <SwiftUI/SwiftUI_Metal.h>
using namespace metal;

// The liquid lens (Zelinsky liquid lens), as on the web (src/components/lens.ts): one ring of liquid glass rolls out
// from the point that was pressed. It bends what is under it like a lens, softens it at the crest and splits only the
// shapes it bends into a thin red and cyan fringe; empty background stays clean. It plays on a picture of the page;
// positions are in points, y down, and samples stay inside the picture (its edge repeats, as CLAMP_TO_EDGE on the web).

static float llWave(float u, float w) {
    float k = u / max(w, 1.0);
    return exp(-k * k * 2.0);
}

static half4 llTap(SwiftUI::Layer layer, float2 p, float2 size) {
    return layer.sample(clamp(p, float2(0.5), size - 0.5));
}

[[ stitchable ]] half4 liquidLens(float2 position, SwiftUI::Layer layer, float2 size,
                                  float2 origin, float t, float press, float amp, float ring, float speed, float chroma) {
    float2 rel = position - origin;
    float d = length(rel);
    float2 dir = rel / max(d, 1e-3);
    float u = d - t * speed;
    // The pressed point itself stays calm, so nothing tears under the finger.
    float life = exp(-t * 1.4) * smoothstep(0.0, 0.05, t) * smoothstep(0.0, 40.0, d + 20.0);
    float h = llWave(u, ring) * life;
    float slope = (llWave(u + 1.0, ring) - llWave(u - 1.0, ring)) * 0.5 * ring * life;
    // Held: the surface shrinks toward the finger, about 1% overall and 6% right under it.
    float dent = press * (0.012 + 0.05 * exp(-d * d / 4900.0));
    float2 q = origin + rel * (1.0 + dent) - dir * h * amp * 0.12;
    float2 disp = dir * slope * amp;
    half4 a = llTap(layer, q - disp * (1.0 + chroma), size);
    half4 b = llTap(layer, q - disp * (1.0 - chroma), size);
    half4 c = half4(a.r, b.g, b.b, b.a);
    float blur = max(h, 0.0) * 2.0;
    if (blur > 0.1) {
        float2 s = q - disp;
        c = (c * 2.0h + llTap(layer, s + float2(blur, 0), size) + llTap(layer, s - float2(blur, 0), size)
                      + llTap(layer, s + float2(0, blur), size) + llTap(layer, s - float2(0, blur), size)) / 6.0h;
    }
    return c;
}
