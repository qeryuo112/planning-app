allprojects {
    repositories {
        google()
        mavenCentral()
    }
    // 强制所有 Android 模块（包括第三方插件）统一使用 compileSdk 36，避免 SDK 版本不一致导致构建失败
    afterEvaluate {
        extensions.findByType(com.android.build.api.dsl.CommonExtension::class.java)?.apply {
            compileSdk = 36
        }
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}


tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
