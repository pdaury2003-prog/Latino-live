package ai.exaspark.pip

import android.app.Activity
import android.app.PictureInPictureParams
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Rational
import androidx.core.app.OnUserLeaveHintProvider
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * La ventana flotante de la sala. Mientras está armada, salir de la app deja
 * la pantalla viva en una ventanita: la voz y el video no se cortan.
 *
 * Android 12 y siguientes la abren solos al pasar a segundo plano
 * (setAutoEnterEnabled). En Android 8 a 11 se abre al pulsar Inicio o
 * recientes (onUserLeaveHint) y no cuando la app abre otra pantalla, como la
 * galería, para que una foto del chat no saque la sala a flote sin querer.
 */
class PictureInPictureModule : Module() {

    private val main = Handler(Looper.getMainLooper())

    @Volatile
    private var wanted = false

    private var leaveHint: Runnable? = null
    private var listening: Activity? = null

    private fun onScreen(block: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) block() else main.post(block)
    }

    private fun activity(): Activity? = appContext.activityProvider?.currentActivity

    private fun supported(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false
        val activity = activity() ?: return false
        return activity.packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)
    }

    /** 9:16 conserva la forma de la sala dentro de la ventanita. */
    private fun params(): PictureInPictureParams? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return null
        val builder = PictureInPictureParams.Builder().setAspectRatio(Rational(9, 16))
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setAutoEnterEnabled(wanted)
            builder.setSeamlessResizeEnabled(true)
        }
        return builder.build()
    }

    private fun inWindow(activity: Activity): Boolean =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && activity.isInPictureInPictureMode

    private fun enter(activity: Activity) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        if (inWindow(activity)) return
        val params = params() ?: return
        try {
            activity.enterPictureInPictureMode(params)
        } catch (_: Throwable) {
            // La sala sigue en pantalla completa; nada se pierde.
        }
    }

    /** Android 8 a 11: la persona sale con Inicio o recientes y abrimos la ventana. */
    private fun bindLeaveHint() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) return
        val host = activity() ?: return
        val provider = host as? OnUserLeaveHintProvider ?: return
        if (listening !== host) unbindLeaveHint()
        if (leaveHint != null) return
        val listener = Runnable { if (wanted) enter(host) }
        try {
            provider.addOnUserLeaveHintListener(listener)
        } catch (_: Throwable) {
            return
        }
        leaveHint = listener
        listening = host
    }

    private fun unbindLeaveHint() {
        val host = listening
        val listener = leaveHint
        if (host != null && listener != null) {
            try {
                (host as? OnUserLeaveHintProvider)?.removeOnUserLeaveHintListener(listener)
            } catch (_: Throwable) {
                // La pantalla ya no existe: nada que soltar.
            }
        }
        listening = null
        leaveHint = null
    }

    private fun apply() {
        val activity = activity() ?: return
        val params = params() ?: return
        try {
            activity.setPictureInPictureParams(params)
        } catch (_: Throwable) {
            return
        }
        if (wanted) bindLeaveHint() else unbindLeaveHint()
    }

    override fun definition() = ModuleDefinition {
        Name("PictureInPicture")

        AsyncFunction("isSupported") { supported() }

        AsyncFunction("isEnabled") { wanted }

        AsyncFunction("isInPictureInPicture") { activity()?.let { inWindow(it) } ?: false }

        AsyncFunction("setEnabled") { value: Boolean, promise: Promise ->
            wanted = value
            onScreen {
                try {
                    apply()
                } finally {
                    promise.resolve(value)
                }
            }
        }

        AsyncFunction("enter") { promise: Promise ->
            onScreen {
                val activity = activity()
                if (activity != null) enter(activity)
                promise.resolve(activity != null)
            }
        }

        OnDestroy { unbindLeaveHint() }
    }
}
