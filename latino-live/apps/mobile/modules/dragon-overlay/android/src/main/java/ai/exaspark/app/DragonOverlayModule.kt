package ai.exaspark.app

import android.os.Handler
import android.os.Looper
import android.view.ViewGroup
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The bridge between the app and the dragon's layer. The app measures the
 * seats and asks for an animation; the layer draws it above the room.
 *
 * Every view is created and touched on the screen's own thread. The app asks
 * from a background thread, and Android closes the app when a view is built
 * anywhere else, so the work is always handed to the screen first.
 */
class DragonOverlayModule : Module() {

    private val main = Handler(Looper.getMainLooper())

    @Volatile
    private var overlay: DragonOverlay? = null

    /** This phone already gave up on the layer; the room keeps working. */
    @Volatile
    private var failed = false

    private fun onScreen(block: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) block() else main.post(block)
    }

    /** The layer lives above the app's own view, so it needs the screen. */
    private fun layer(): DragonOverlay? {
        if (failed) return null
        val activity = appContext.activityProvider?.currentActivity ?: return null
        val content = activity.findViewById<ViewGroup>(android.R.id.content) ?: return null
        val current = overlay
        if (current != null) {
            if (current.isGone) {
                failed = true
                overlay = null
                return null
            }
            return current
        }
        val created = DragonOverlay(content)
        created.attach()
        if (created.isGone) {
            failed = true
            return null
        }
        overlay = created
        return created
    }

    override fun definition() = ModuleDefinition {
        Name("DragonOverlay")

        AsyncFunction("playEmotion") { x: Double, y: Double, size: Double, emotion: String ->
            onScreen { layer()?.play(x.toFloat(), y.toFloat(), size.toFloat(), emotion) }
        }

        AsyncFunction("playCouple") { leftX: Double, leftY: Double, rightX: Double, rightY: Double, size: Double ->
            onScreen {
                layer()?.couple(leftX.toFloat(), leftY.toFloat(), rightX.toFloat(), rightY.toFloat(), size.toFloat())
            }
        }

        /** Whether the layer has loaded and can already draw. */
        AsyncFunction("isReady") { overlay?.isReady ?: false }

        /** Opens the layer ahead of the first dragon, so it is warm when asked. */
        AsyncFunction("prepare") {
            onScreen { layer() }
            true
        }

        /** The app left the screen: stop the layer's clock and drawing. */
        AsyncFunction("pause") { onScreen { overlay?.pause() } }

        /** The app is back: the layer draws again. */
        AsyncFunction("resume") { onScreen { overlay?.resume() } }

        AsyncFunction("destroy") {
            onScreen {
                overlay?.destroy()
                overlay = null
                // Leaving the room clears the layer for the next one.
                failed = false
            }
        }
    }
}
