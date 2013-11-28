package util;

import static com.codeborne.selenide.WebDriverRunner.getWebDriver;

import org.junit.Rule;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.remote.RemoteWebDriver;

import com.saucelabs.common.SauceOnDemandSessionIdProvider;
import com.saucelabs.junit.SauceOnDemandTestWatcher;

/**
 * A wrapper to test classes to add sauce test watcher and common constants.
 * 
 */
public class TestWrapper implements SauceOnDemandSessionIdProvider {
	protected static final String BASE_URL = System.getProperty("endpoint");
	protected static final int BASE_TIMEOUT = Integer.parseInt(System
			.getProperty("globaltimeout", "15000"));
	protected static final int CHANGE_STATUS_TIMEOUT = Integer.parseInt(System
			.getProperty("statustimeout", "240000"));

	SauceAuthentication sa = new SauceAuthentication();
	protected static WebDriver driver = getWebDriver();
	public @Rule
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
