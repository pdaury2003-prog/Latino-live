package ai.exaspark.app

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebViewClient
import android.webkit.JavascriptInterface
import android.webkit.WebView
import java.util.Locale

/**
 * DragonOverlay: the room's dragon in 3D, drawn above the seats.
 *
 * The room stays a flat screen: this is a transparent layer on top of it. The
 * page it shows is `dragon_layer.html`, which carries the model and its own
 * animations.
 *
 * Two ways to ask for an animation:
 *   - with the View of a seat: `emote(seat, "Beso")`
 *   - with the position of a seat in the window: `play(x, y, size, "Beso")`
 * The second one is what the app uses: it already knows where each seat is.
 */
@SuppressLint("ViewConstructor")
class PassThroughWebView(context: Context) : WebView(context) {
    // Touches are not consumed: they reach the seats and buttons below.
    override fun dispatchTouchEvent(ev: MotionEvent): Boolean = false
    override fun onTouchEvent(event: MotionEvent): Boolean = false
}

/**
 * The page's way back to the app. The web view finds it by name, so it has to
 * be a public class of its own: an object made inline can be skipped by the
 * web view's own lookup, and then the page would never say it is ready.
 */
class DragonBridge(private val onPageMessage: (String) -> Unit) {
    @JavascriptInterface
    fun postMessage(message: String) {
        onPageMessage(message)
    }
}

class DragonOverlay(private val host: ViewGroup) {

    private val webView = PassThroughWebView(host.context)
    private val density = host.resources.displayMetrics.density
    private val pending = mutableListOf<String>()
    @Volatile
    private var ready = false
    @Volatile
    private var gone = false

    /** Whether the page has loaded and can already take an order. */
    val isReady: Boolean get() = ready

    /** True once this phone could not keep the layer: the room goes on without it. */
    val isGone: Boolean get() = gone

    fun attach() {
        // A phone that cannot give the layer a web view simply keeps its room:
        // the dragon is decoration, and the room must open anyway.
        try {
            prepare()
        } catch (_: Throwable) {
            gone = true
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun prepare() {
        webView.setBackgroundColor(Color.TRANSPARENT)
        webView.settings.javaScriptEnabled = true
        webView.settings.allowFileAccess = true
        // The page reads its two models from the same assets folder it lives in.
        webView.settings.allowFileAccessFromFileURLs = true
        webView.settings.allowUniversalAccessFromFileURLs = true
        // The drawing runs on the phone's own GPU; without it the page still
        // loads and simply shows nothing instead of stopping the room.
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        webView.isClickable = false
        webView.isFocusable = false
        webView.webViewClient = object : WebViewClient() {
            /**
             * Android ends the page's process when a phone runs out of memory.
             * Told nothing, it closes the whole app with it. Answering `true`
             * keeps the room open and lets this layer step aside.
             */
            override fun onRenderProcessGone(
                view: WebView?,
                detail: RenderProcessGoneDetail?
            ): Boolean {
                gone = true
                ready = false
                pending.clear()
                host.post {
                    try {
                        host.removeView(webView)
                    } catch (_: Throwable) {
                        // Already detached.
                    }
                    try {
                        webView.destroy()
                    } catch (_: Throwable) {
                        // Already gone.
                    }
                }
                return true
            }

        }
        webView.addJavascriptInterface(DragonBridge { message ->
            if (message != "ready" || gone) return@DragonBridge
            host.post {
                if (gone) return@post
                ready = true
                pending.forEach { line ->
                    try {
                        webView.evaluateJavascript(line, null)
                    } catch (_: Throwable) {
                        gone = true
                    }
                }
                pending.clear()
            }
        }, "DragonBridge")
        host.addView(
            webView,
            ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        )
        webView.loadUrl("file:///android_asset/dragon_layer.html")
    }

    /** One emotion of the dragon over a seat. */
    fun emote(seat: View, name: String) {
        val s = point(seat)
        play(s.x, s.y, s.size, name)
    }

    /**
 * One emotion of the dragon over a seat whose position the app already
 * knows. The position is in the window, like the ones the app measures.
 */
    fun play(x: Float, y: Float, size: Float, name: String) {
        val local = toLayer(x, y)
        send("DragonLayer.play(${f(local.first)},${f(local.second)},${f(size)},'${name.replace("'", "")}')")
    }

    /** The two dragons walk to each other and kiss. */
    fun couple(leftX: Float, leftY: Float, rightX: Float, rightY: Float, size: Float) {
        // The page counts from its own corner, like every other order.
        val left = toLayer(leftX, leftY)
        val right = toLayer(rightX, rightY)
        send(
            "DragonLayer.playCouple(${f(left.first)},${f(left.second)}," +
                "${f(right.first)},${f(right.second)},${f(size)})"
        )
    }

    /** The couple complete: the two of them at the same time. */
    fun pareja(seatHombre: View, seatMujer: View) {
        parejaHombre(seatHombre, seatMujer)
        parejaMujer(seatHombre, seatMujer)
    }

    /** Only the man: he walks two steps to the right, to the middle point. */
    fun parejaHombre(seatHombre: View, seatMujer: View, retrasoSeg: Float = 0f) =
        miembro("hombre", seatHombre, seatHombre, seatMujer, retrasoSeg)

    /** Only the woman: she walks two steps to the left, to the middle point. */
    fun parejaMujer(seatHombre: View, seatMujer: View, retrasoSeg: Float = 0f) =
        miembro("mujer", seatMujer, seatHombre, seatMujer, retrasoSeg)

    /** Whether this seat can kiss: only when the seat next to it is taken. */
    fun puedeBesar(indice: Int, ocupados: List<Boolean>, columnas: Int = 5): Boolean =
        vecino(indice, ocupados, columnas) != null

    /**
     * A kiss with the neighbour. Nothing happens when the seat is free or
     * when the seat next to it is empty. The left seat is the man and the
     * right one the woman.
     */
    fun besoConVecino(seats: List<View>, ocupados: List<Boolean>, indice: Int, columnas: Int = 5): Boolean {
        val par = vecino(indice, ocupados, columnas) ?: return false
        pareja(seats[par.first], seats[par.second])
        return true
    }

    fun destroy() {
        ready = false
        pending.clear()
        try {
            host.removeView(webView)
            webView.destroy()
        } catch (_: Throwable) {
            // The layer may already be gone with its page.
        }
    }

    /**
     * The phone went to another app: the layer stops its clock and its
     * drawing, so a dragon nobody is looking at does not drain the battery.
     */
    fun pause() {
        try {
            webView.onPause()
        } catch (_: Throwable) {
            // A page that is still starting has nothing to pause.
        }
    }

    fun resume() {
        try {
            webView.onResume()
        } catch (_: Throwable) {
            // Same: an unfinished page simply keeps loading.
        }
    }

    // -------------------------------------------------------------------------------------------

    private class Pt(val x: Float, val y: Float, val size: Float)

    /** Center and diameter of the seat in dp, relative to the layer. */
    private fun point(seat: View): Pt {
        val a = IntArray(2); seat.getLocationOnScreen(a)
        val b = IntArray(2); webView.getLocationOnScreen(b)
        return Pt(
            (a[0] - b[0] + seat.width / 2f) / density,
            (a[1] - b[1] + seat.height / 2f) / density,
            seat.width / density
        )
    }

    /** The position of the window, relative to the layer that covers it. */
    private fun toLayer(x: Float, y: Float): Pair<Float, Float> {
        val b = IntArray(2); webView.getLocationInWindow(b)
        return Pair(x - b[0], y - b[1])
    }

    /**
     * The occupied seat next to this one: (left, right) on the same row, or
     * null when the seat is free or nobody sits beside it.
     */
    private fun vecino(i: Int, ocupados: List<Boolean>, columnas: Int): Pair<Int, Int>? {
        if (i !in ocupados.indices || !ocupados[i]) return null
        if (columnas <= 0) return null
        val col = i % columnas
        if (col < columnas - 1 && i + 1 < ocupados.size && ocupados[i + 1]) return Pair(i, i + 1)
        if (col > 0 && ocupados[i - 1]) return Pair(i - 1, i)
        return null
    }

    private fun miembro(rol: String, own: View, hombre: View, mujer: View, retrasoSeg: Float) {
        val o = point(own); val h = point(hombre); val m = point(mujer)
        val mx = (h.x + m.x) / 2f
        val my = (h.y + m.y) / 2f
        send("DragonLayer.playPareja('$rol',${f(o.x)},${f(o.y)},${f(o.size)},${f(mx)},${f(my)},${f(retrasoSeg)})")
    }

    private fun f(v: Float) = String.format(Locale.US, "%.1f", v)

    private fun send(js: String) {
        if (gone) return
        host.post {
            if (gone) return@post
            if (ready) {
                try {
                    webView.evaluateJavascript(js, null)
                } catch (_: Throwable) {
                    gone = true
                    ready = false
                }
            } else {
                pending.add(js)
            }
        }
    }
}
