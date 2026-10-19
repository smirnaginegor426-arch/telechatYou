plugins {
    id("com.android.application")
}

android {
    namespace = "com.telechatyou.mobile"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.telechatyou.mobile"
        minSdk = 23
        targetSdk = 35
        versionCode = 3
        versionName = "2.0.0-alpha.2"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
}
