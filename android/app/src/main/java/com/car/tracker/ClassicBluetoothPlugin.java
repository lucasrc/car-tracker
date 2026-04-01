package com.car.tracker;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.lang.reflect.Method;
import java.util.Set;

@CapacitorPlugin(
    name = "ClassicBluetooth",
    permissions = {
        @Permission(alias = "bluetooth", strings = {
            Manifest.permission.BLUETOOTH_CONNECT,
            Manifest.permission.BLUETOOTH_SCAN
        }),
    }
)
public class ClassicBluetoothPlugin extends com.getcapacitor.Plugin {

    private BroadcastReceiver serviceReceiver;
    private String selectedDeviceAddress = null;
    private boolean isMonitoring = false;

    private static final String PREFS_NAME = "car_tracker_prefs";
    private static final String KEY_AUTO_TRACKING = "auto_tracking_enabled";
    private static final String KEY_DEVICE_ADDRESS = "device_address";
    private static final String KEY_DEVICE_NAME = "device_name";

    private SharedPreferences getPrefs() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private void savePrefs(String deviceAddress, String deviceName, boolean autoTracking) {
        getPrefs().edit()
            .putString(KEY_DEVICE_ADDRESS, deviceAddress)
            .putString(KEY_DEVICE_NAME, deviceName)
            .putBoolean(KEY_AUTO_TRACKING, autoTracking)
            .apply();
    }

    private void clearPrefs() {
        getPrefs().edit()
            .putString(KEY_DEVICE_ADDRESS, null)
            .putString(KEY_DEVICE_NAME, null)
            .putBoolean(KEY_AUTO_TRACKING, false)
            .apply();
    }

    private BluetoothAdapter getBluetoothAdapter() {
        try {
            BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
            if (manager != null) {
                return manager.getAdapter();
            }
        } catch (Exception e) {
            android.util.Log.e("ClassicBluetooth", "Error getting adapter via BluetoothManager", e);
        }
        return BluetoothAdapter.getDefaultAdapter();
    }

    private boolean hasPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return getContext().checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        BluetoothAdapter adapter = getBluetoothAdapter();
        android.util.Log.d("ClassicBluetooth", "isAvailable: adapter=" + (adapter != null));
        JSObject ret = new JSObject();
        ret.put("available", adapter != null);
        call.resolve(ret);
    }

    @PluginMethod
    public void isEnabled(PluginCall call) {
        BluetoothAdapter adapter = getBluetoothAdapter();
        JSObject ret = new JSObject();
        ret.put("enabled", adapter != null && adapter.isEnabled());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        android.util.Log.d("ClassicBluetooth", "requestPermissions: has=" + hasPermission());
        if (hasPermission()) {
            call.resolve();
            return;
        }
        requestPermissionForAlias("bluetooth", call, "permsCallback");
    }

    @PermissionCallback
    private void permsCallback(PluginCall call) {
        android.util.Log.d("ClassicBluetooth", "permsCallback");
        if (call == null) return;
        if (hasPermission()) {
            call.resolve();
        } else {
            call.reject("Bluetooth permission denied");
        }
    }

    @PluginMethod
    public void getBondedDevices(PluginCall call) {
        android.util.Log.d("ClassicBluetooth", "getBondedDevices called, hasPerm=" + hasPermission());
        if (!hasPermission()) {
            requestPermissionForAlias("bluetooth", call, "bondedCallback");
            return;
        }
        doGetBondedDevices(call);
    }

    @PermissionCallback
    private void bondedCallback(PluginCall call) {
        android.util.Log.d("ClassicBluetooth", "bondedCallback, hasPerm=" + hasPermission());
        if (call == null) return;
        if (hasPermission()) {
            doGetBondedDevices(call);
        } else {
            call.reject("Bluetooth permission denied");
        }
    }

    private void doGetBondedDevices(PluginCall call) {
        android.util.Log.d("ClassicBluetooth", "doGetBondedDevices START");
        try {
            BluetoothAdapter adapter = getBluetoothAdapter();
            if (adapter == null) {
                call.reject("Bluetooth not available");
                return;
            }

            Set<BluetoothDevice> bondedDevices = adapter.getBondedDevices();
            android.util.Log.d("ClassicBluetooth", "Got " + bondedDevices.size() + " bonded devices");

            JSArray devices = new JSArray();
            for (BluetoothDevice device : bondedDevices) {
                JSObject dev = new JSObject();
                dev.put("name", device.getName() != null ? device.getName() : "Unknown");
                dev.put("address", device.getAddress());

                int type = device.getType();
                String typeStr = "unknown";
                switch (type) {
                    case BluetoothDevice.DEVICE_TYPE_CLASSIC: typeStr = "classic"; break;
                    case BluetoothDevice.DEVICE_TYPE_LE: typeStr = "le"; break;
                    case BluetoothDevice.DEVICE_TYPE_DUAL: typeStr = "dual"; break;
                }
                dev.put("type", typeStr);
                dev.put("bonded", device.getBondState() == BluetoothDevice.BOND_BONDED);
                devices.put(dev);
            }

            JSObject ret = new JSObject();
            ret.put("devices", devices);
            android.util.Log.d("ClassicBluetooth", "Resolving with " + bondedDevices.size() + " devices");
            call.resolve(ret);
            android.util.Log.d("ClassicBluetooth", "doGetBondedDevices DONE");
        } catch (Exception e) {
            android.util.Log.e("ClassicBluetooth", "Error in getBondedDevices", e);
            call.reject("Error: " + e.getMessage());
        }
    }

    @PluginMethod
    public void startMonitoring(PluginCall call) {
        android.util.Log.d("ClassicBluetooth", "startMonitoring called");
        if (!hasPermission()) {
            requestPermissionForAlias("bluetooth", call, "monitoringCallback");
            return;
        }
        doStartMonitoring(call);
    }

    @PluginMethod
    public void setAutoTracking(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", false);
        String deviceAddress = call.getString("deviceAddress", null);
        String deviceName = call.getString("deviceName", null);

        android.util.Log.d("ClassicBluetooth", "setAutoTracking: enabled=" + enabled + ", address=" + deviceAddress);
        savePrefs(deviceAddress, deviceName, enabled);
        call.resolve();
    }

    @PermissionCallback
    private void monitoringCallback(PluginCall call) {
        android.util.Log.d("ClassicBluetooth", "monitoringCallback");
        if (call == null) return;
        if (hasPermission()) {
            doStartMonitoring(call);
        } else {
            call.reject("Bluetooth permission denied");
        }
    }

    private void doStartMonitoring(PluginCall call) {
        android.util.Log.d("ClassicBluetooth", "doStartMonitoring START");
        try {
            String deviceAddress = call.getString("deviceAddress");
            if (deviceAddress == null || deviceAddress.isEmpty()) {
                call.reject("deviceAddress is required");
                return;
            }

            String deviceName = call.getString("deviceName", "Unknown");

            android.util.Log.d("ClassicBluetooth", "Starting foreground service for: " + deviceAddress);
            selectedDeviceAddress = deviceAddress;
            isMonitoring = true;

            savePrefs(deviceAddress, deviceName, true);

            // Unregister any previous service receiver
            if (serviceReceiver != null) {
                try {
                    getContext().unregisterReceiver(serviceReceiver);
                } catch (IllegalArgumentException e) {
                    // Already unregistered
                }
            }

            // Register receiver to listen for service broadcasts
            serviceReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    String action = intent.getAction();
                    String address = intent.getStringExtra("address");
                    String name = intent.getStringExtra("name");

                    if (address == null || !address.equals(selectedDeviceAddress)) {
                        return;
                    }

                    JSObject data = new JSObject();
                    data.put("address", address);
                    data.put("name", name != null ? name : "Unknown");

                    if (BluetoothMonitorService.ACTION_DEVICE_CONNECTED.equals(action)) {
                        data.put("status", "connected");
                        android.util.Log.d("ClassicBluetooth", "Device connected: " + name);
                        notifyListeners("deviceConnected", data);
                    } else if (BluetoothMonitorService.ACTION_DEVICE_DISCONNECTED.equals(action)) {
                        data.put("status", "disconnected");
                        android.util.Log.d("ClassicBluetooth", "Device disconnected: " + name);
                        notifyListeners("deviceDisconnected", data);
                    }
                }
            };

            IntentFilter filter = new IntentFilter();
            filter.addAction(BluetoothMonitorService.ACTION_DEVICE_CONNECTED);
            filter.addAction(BluetoothMonitorService.ACTION_DEVICE_DISCONNECTED);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                getContext().registerReceiver(serviceReceiver, filter, Context.RECEIVER_EXPORTED);
            } else {
                getContext().registerReceiver(serviceReceiver, filter);
            }

            // Start the foreground service
            Intent serviceIntent = new Intent(getContext(), BluetoothMonitorService.class);
            serviceIntent.setAction(BluetoothMonitorService.ACTION_START);
            serviceIntent.putExtra(BluetoothMonitorService.EXTRA_DEVICE_ADDRESS, deviceAddress);
            serviceIntent.putExtra(BluetoothMonitorService.EXTRA_DEVICE_NAME, deviceName);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(serviceIntent);
            } else {
                getContext().startService(serviceIntent);
            }

            JSObject ret = new JSObject();
            ret.put("monitoring", true);
            call.resolve(ret);
            android.util.Log.d("ClassicBluetooth", "doStartMonitoring DONE - service started");
        } catch (Exception e) {
            android.util.Log.e("ClassicBluetooth", "Error in startMonitoring", e);
            call.reject("Error: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopMonitoring(PluginCall call) {
        android.util.Log.d("ClassicBluetooth", "stopMonitoring");

        // Stop the foreground service
        Intent serviceIntent = new Intent(getContext(), BluetoothMonitorService.class);
        serviceIntent.setAction(BluetoothMonitorService.ACTION_STOP);
        getContext().startService(serviceIntent);

        // Unregister receiver
        if (serviceReceiver != null) {
            try {
                getContext().unregisterReceiver(serviceReceiver);
            } catch (IllegalArgumentException e) {
                // Already unregistered
            }
            serviceReceiver = null;
        }
        isMonitoring = false;
        selectedDeviceAddress = null;

        clearPrefs();
        call.resolve();
    }

    @PluginMethod
    public void isConnected(PluginCall call) {
        String deviceAddress = call.getString("deviceAddress");
        if (deviceAddress == null) {
            call.reject("deviceAddress is required");
            return;
        }

        if (!hasPermission()) {
            requestPermissionForAlias("bluetooth", call, "connectedCallback");
            return;
        }
        doIsConnected(call, deviceAddress);
    }

    @PermissionCallback
    private void connectedCallback(PluginCall call) {
        android.util.Log.d("ClassicBluetooth", "connectedCallback");
        if (call == null) return;
        if (hasPermission()) {
            doIsConnected(call, call.getString("deviceAddress"));
        } else {
            JSObject ret = new JSObject();
            ret.put("connected", false);
            call.resolve(ret);
        }
    }

    private void doIsConnected(PluginCall call, String deviceAddress) {
        try {
            BluetoothAdapter adapter = getBluetoothAdapter();
            if (adapter == null) {
                JSObject ret = new JSObject();
                ret.put("connected", false);
                call.resolve(ret);
                return;
            }

            BluetoothDevice device = adapter.getRemoteDevice(deviceAddress);
            boolean connected = isDeviceConnected(device);

            JSObject ret = new JSObject();
            ret.put("connected", connected);
            call.resolve(ret);
        } catch (Exception e) {
            android.util.Log.e("ClassicBluetooth", "Error in isConnected", e);
            JSObject ret = new JSObject();
            ret.put("connected", false);
            call.resolve(ret);
        }
    }

    private boolean isDeviceConnected(BluetoothDevice device) {
        try {
            Method method = device.getClass().getMethod("isConnected");
            return (Boolean) method.invoke(device);
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (serviceReceiver != null) {
            try {
                getContext().unregisterReceiver(serviceReceiver);
            } catch (IllegalArgumentException e) {
                // Already unregistered
            }
            serviceReceiver = null;
        }

        // Stop the service
        Intent serviceIntent = new Intent(getContext(), BluetoothMonitorService.class);
        serviceIntent.setAction(BluetoothMonitorService.ACTION_STOP);
        getContext().startService(serviceIntent);
    }
}
