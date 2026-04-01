package com.car.tracker;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

import com.getcapacitor.JSObject;

public class BluetoothMonitorService extends Service {

    public static final String ACTION_START = "com.car.tracker.BLUETOOTH_MONITOR_START";
    public static final String ACTION_STOP = "com.car.tracker.BLUETOOTH_MONITOR_STOP";
    public static final String EXTRA_DEVICE_ADDRESS = "device_address";
    public static final String EXTRA_DEVICE_NAME = "device_name";

    public static final String ACTION_DEVICE_CONNECTED = "com.car.tracker.DEVICE_CONNECTED";
    public static final String ACTION_DEVICE_DISCONNECTED = "com.car.tracker.DEVICE_DISCONNECTED";

    private static final String CHANNEL_ID = "bluetooth_monitor_channel";
    private static final int NOTIFICATION_ID = 1001;

    private String selectedDeviceAddress;
    private String selectedDeviceName;
    private BroadcastReceiver connectionReceiver;

    @Override
    public void onCreate() {
        super.onCreate();
        android.util.Log.d("BluetoothMonitorService", "onCreate called");
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        android.util.Log.d("BluetoothMonitorService", "onStartCommand: action=" + (intent != null ? intent.getAction() : "null"));
        if (intent == null) return START_STICKY;

        String action = intent.getAction();
        if (ACTION_START.equals(action)) {
            selectedDeviceAddress = intent.getStringExtra(EXTRA_DEVICE_ADDRESS);
            selectedDeviceName = intent.getStringExtra(EXTRA_DEVICE_NAME);
            android.util.Log.d("BluetoothMonitorService", "Starting monitoring for: " + selectedDeviceAddress + " (" + selectedDeviceName + ")");
            startForegroundNotification();
            startMonitoring();
        } else if (ACTION_STOP.equals(action)) {
            android.util.Log.d("BluetoothMonitorService", "Stopping service");
            stopMonitoring();
            stopForeground();
            stopSelf();
        }

        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        stopMonitoring();
        super.onDestroy();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Bluetooth Monitor",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Monitoring car Bluetooth connection");
            channel.setShowBadge(false);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private void startForegroundNotification() {
        android.util.Log.d("BluetoothMonitorService", "startForegroundNotification called");
        Intent stopIntent = new Intent(this, BluetoothMonitorService.class);
        stopIntent.setAction(ACTION_STOP);
        PendingIntent stopPendingIntent = PendingIntent.getService(
            this, 0, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent launchPendingIntent = PendingIntent.getActivity(
            this, 0, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Car Tracker")
            .setContentText("Monitoring: " + (selectedDeviceName != null ? selectedDeviceName : "Unknown"))
            .setSmallIcon(R.drawable.ic_notification)
            .setContentIntent(launchPendingIntent)
            .addAction(0, "Stop", stopPendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();

        android.util.Log.d("BluetoothMonitorService", "Calling startForeground with notification");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        android.util.Log.d("BluetoothMonitorService", "startForeground completed");
    }

    private void stopForeground() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(Service.STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
    }

    private void startMonitoring() {
        if (connectionReceiver != null) {
            unregisterReceiver(connectionReceiver);
        }

        connectionReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String action = intent.getAction();
                BluetoothDevice device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);

                if (device == null || selectedDeviceAddress == null) return;
                if (!device.getAddress().equals(selectedDeviceAddress)) return;

                String broadcastAction = null;
                if (BluetoothDevice.ACTION_ACL_CONNECTED.equals(action)) {
                    broadcastAction = ACTION_DEVICE_CONNECTED;
                } else if (BluetoothDevice.ACTION_ACL_DISCONNECTED.equals(action)) {
                    broadcastAction = ACTION_DEVICE_DISCONNECTED;
                }

                if (broadcastAction != null) {
                    Intent broadcast = new Intent(broadcastAction);
                    broadcast.putExtra("address", device.getAddress());
                    broadcast.putExtra("name", device.getName() != null ? device.getName() : "Unknown");
                    sendBroadcast(broadcast);
                }
            }
        };

        IntentFilter filter = new IntentFilter();
        filter.addAction(BluetoothDevice.ACTION_ACL_CONNECTED);
        filter.addAction(BluetoothDevice.ACTION_ACL_DISCONNECTED);
        registerReceiver(connectionReceiver, filter);
    }

    private void stopMonitoring() {
        if (connectionReceiver != null) {
            try {
                unregisterReceiver(connectionReceiver);
            } catch (IllegalArgumentException e) {
                // Already unregistered
            }
            connectionReceiver = null;
        }
    }
}
