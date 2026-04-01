package com.car.tracker;

import android.content.SharedPreferences;
import android.content.Context;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PluginCall;
import com.getcapacitor.JSObject;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BackgroundTracker")
public class BackgroundTracker extends Plugin {

    private static final String PREFS_NAME = "car_tracker_prefs";
    private static final String KEY_TRACKING_ACTIVE = "tracking_active";
    private static final String KEY_TRIP_START_TIME = "trip_start_time";
    private static final String KEY_CONNECTED_DEVICE_ADDRESS = "connected_device_address";
    private static final String KEY_CONNECTED_DEVICE_NAME = "connected_device_name";

    @PluginMethod
    public void getTrackingState(PluginCall call) {
        Context context = this.getContext();
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        
        boolean isTracking = prefs.getBoolean(KEY_TRACKING_ACTIVE, false);
        String startTimeStr = prefs.getString(KEY_TRIP_START_TIME, null);
        String deviceAddress = prefs.getString(KEY_CONNECTED_DEVICE_ADDRESS, null);
        String deviceName = prefs.getString(KEY_CONNECTED_DEVICE_NAME, null);
        
        Long startTime = null;
        if (startTimeStr != null) {
            try {
                startTime = Long.parseLong(startTimeStr);
            } catch (NumberFormatException e) {
                startTime = null;
            }
        }
        
        JSObject result = new JSObject();
        result.put("isTracking", isTracking);
        result.put("startTime", startTime);
        result.put("deviceAddress", deviceAddress);
        result.put("deviceName", deviceName);
        
        call.resolve(result);
    }

    @PluginMethod
    public void clearTrackingState(PluginCall call) {
        Context context = this.getContext();
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        
        prefs.edit()
            .putBoolean(KEY_TRACKING_ACTIVE, false)
            .remove(KEY_TRIP_START_TIME)
            .remove(KEY_CONNECTED_DEVICE_ADDRESS)
            .remove(KEY_CONNECTED_DEVICE_NAME)
            .apply();
        
        call.resolve();
    }
}