package com.joyent.piranha.utils;

import com.codeborne.selenide.WebDriverRunner;
import org.apache.commons.io.FileUtils;
import org.junit.rules.MethodRule;
import org.junit.runners.model.FrameworkMethod;
import org.junit.runners.model.Statement;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;

import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;

public class ScreenshotTestRule implements MethodRule {
    public Statement apply(final Statement statement, final FrameworkMethod frameworkMethod, final Object o) {
        return new Statement() {
            @Override
            public void evaluate() throws Throwable {
                try {
                    statement.evaluate();
                } catch (Throwable t) {
                    // exception will be thrown only when a test fails.
                    captureScreenshot(frameworkMethod.getName());
                    // rethrow to allow the failure to be reported by JUnit
                    throw t;
                }
            }

            public void captureScreenshot(String methodName) throws IOException {
                File screenshot = ((TakesScreenshot) WebDriverRunner.getWebDriver()).getScreenshotAs(OutputType.FILE);
                SimpleDateFormat sdf = new SimpleDateFormat("MMddyyy");
                String pathname = "./failureShots/" + sdf.format(new Date());
                File folder = new File(pathname);
                if (!(folder.exists())) {
                    folder.mkdir();
                }
                FileUtils.copyFile(screenshot, new File(pathname + "/" + methodName + "_" + System.currentTimeMillis() + ".png"));
            }
        };
    }
}