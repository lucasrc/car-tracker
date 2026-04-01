package com.car.tracker;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

public class BootReceiver extends BroadcastReceiver {

    private static final String PREFS_NAME = "car_tracker_prefs";
    private static final String KEY_AUTO_TRACKING = "auto_tracking_enabled";
    private static final String KEY_DEVICE_ADDRESS = "device_address";
    private static final String KEY_DEVICE_NAME = "device_name";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action) && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            return;
        }

        android.util.Log.d("BootReceiver", "Received: " + action);

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean autoTrackingEnabled = prefs.getBoolean(KEY_AUTO_TRACKING, false);

        if (!autoTrackingEnabled) {
            android.util.Log.d("BootReceiver", "Auto-tracking not enabled, skipping");
            return;
        }

        String deviceAddress = prefs.getString(KEY_DEVICE_ADDRESS, null);
        String deviceName = prefs.getString(KEY_DEVICE_NAME, null);

        if (deviceAddress == null) {
            android.util.Log.d("BootReceiver", "No device configured, skipping");
            return;
        }

        android.util.Log.d("BootReceiver", "Starting BluetoothMonitorService for: " + deviceAddress + " (" + deviceName + ")");

        Intent serviceIntent = new Intent(context, BluetoothMonitorService.class);
        serviceIntent.setAction(BluetoothMonitorService.ACTION_START);
        serviceIntent.putExtra(BluetoothMonitorService.EXTRA_DEVICE_ADDRESS, deviceAddress);
        serviceIntent.putExtra(BluetoothMonitorService.EXTRA_DEVICE_NAME, deviceName != null ? deviceName : "Unknown");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent);
        } else {
            context.startService(serviceIntent);
        }
    }
}
