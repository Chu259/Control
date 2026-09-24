package com.depos.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private static final int PERMISSION_REQUEST_CODE = 2026;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestLocalNetworkPermissions();
    }

    private void requestLocalNetworkPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            List<String> permissions = new ArrayList<>();
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.ACCESS_FINE_LOCATION);
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.ACCESS_COARSE_LOCATION);
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (ContextCompat.checkSelfPermission(this, "android.permission.NEARBY_WIFI_DEVICES") != PackageManager.PERMISSION_GRANTED) {
                    permissions.add("android.permission.NEARBY_WIFI_DEVICES");
                }
            }
            if (!permissions.isEmpty()) {
                ActivityCompat.requestPermissions(this, permissions.toArray(new String[0]), PERMISSION_REQUEST_CODE);
            }
        }
    }
}
