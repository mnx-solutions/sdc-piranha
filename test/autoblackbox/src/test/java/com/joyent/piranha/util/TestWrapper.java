package com.joyent.piranha.util;

import com.joyent.piranha.PropertyHolder;
import com.saucelabs.common.SauceOnDemandSessionIdProvider;
import com.saucelabs.junit.SauceOnDemandTestWatcher;
import org.junit.Rule;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.remote.RemoteWebDriver;

import static com.codeborne.selenide.WebDriverRunner.getWebDriver;

/**
 * A wrapper to test classes to add sauce test watcher and common constants.
 */
public class TestWrapper implements SauceOnDemandSessionIdProvider {
    protected static final String BASE_URL = PropertyHolder.getBaseUrl();
    protected static final int BASE_TIMEOUT = Integer.parseInt(PropertyHolder.getGlobalTimeout());
    protected static final int CHANGE_STATUS_TIMEOUT = Integer.parseInt(PropertyHolder.getChangeStatusTimeout());

    SauceAuthentication sa = new SauceAuthentication();
    protected static WebDriver driver = getWebDriver();
    public
    @Rule
    SauceOnDemandTestWatcher resultReportingTestWatcher = new SauceOnDemandTestWatcher(
            this, sa.getAuthentication());

    @Override
    public String getSessionId() {
        if (System.getProperty("browser") != null
                && System.getProperty("browser").startsWith("util.Sauce")) {
            return ((RemoteWebDriver) driver).getSessionId().toString();
        }
        return null;
    }
}
