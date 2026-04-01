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
        android.util.Log.d("BootReceiver", "onReceive action: " + action);
        
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action) && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            android.util.Log.d("BootReceiver", "Skipping - not BOOT_COMPLETED or MY_PACKAGE_REPLACED");
            return;
        }

        android.util.Log.d("BootReceiver", "Processing BOOT_COMPLETED");

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean autoTrackingEnabled = prefs.getBoolean(KEY_AUTO_TRACKING, false);
        String deviceAddress = prefs.getString(KEY_DEVICE_ADDRESS, null);
        String deviceName = prefs.getString(KEY_DEVICE_NAME, null);

        android.util.Log.d("BootReceiver", "autoTrackingEnabled=" + autoTrackingEnabled + ", deviceAddress=" + deviceAddress + ", deviceName=" + deviceName);

        if (!autoTrackingEnabled) {
            android.util.Log.d("BootReceiver", "Auto-tracking not enabled, skipping");
            return;
        }

        if (deviceAddress == null) {
            android.util.Log.d("BootReceiver", "No device configured, skipping");
            return;
        }

        android.util.Log.d("BootReceiver", "Starting BluetoothMonitorService for: " + deviceAddress + " (" + deviceName + ")");

        Intent serviceIntent = new Intent(context, BluetoothMonitorService.class);
        serviceIntent.setAction(BluetoothMonitorService.ACTION_START);
        serviceIntent.putExtra(BluetoothMonitorService.EXTRA_DEVICE_ADDRESS, deviceAddress);
        serviceIntent.putExtra(BluetoothMonitorService.EXTRA_DEVICE_NAME, deviceName != null ? deviceName : "Unknown");

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
                android.util.Log.d("BootReceiver", "startForegroundService called successfully");
            } else {
                context.startService(serviceIntent);
                android.util.Log.d("BootReceiver", "startService called successfully");
            }
        } catch (Exception e) {
            android.util.Log.e("BootReceiver", "Failed to start service: " + e.getMessage(), e);
        }
    }
}
