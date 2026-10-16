package com.getcapacitor.myapp;

import static org.junit.Assert.*;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.Manifest;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Instrumented test, which will execute on an Android device.
 *
 * @see <a href="http://d.android.com/tools/testing">Testing documentation</a>
 */
@RunWith(AndroidJUnit4.class)
public class ExampleInstrumentedTest {

    @Test
    public void useAppContext() throws Exception {
        // Context of the app under test.
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();

        String packageName = appContext.getPackageName();
        assertTrue("The test must target a CalcioLab build",
            packageName.equals("it.calciolab.coach") || packageName.equals("it.calciolab.coach.debug"));
        assertEquals(PackageManager.PERMISSION_GRANTED,
            appContext.getPackageManager().checkPermission(Manifest.permission.INTERNET, packageName));
        Intent launchIntent = appContext.getPackageManager().getLaunchIntentForPackage(packageName);
        assertNotNull("CalcioLab must expose a launcher activity", launchIntent);
        assertNotNull(launchIntent.getComponent());
        assertEquals("it.calciolab.coach.MainActivity", launchIntent.getComponent().getClassName());
    }
}
