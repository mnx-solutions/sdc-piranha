package util;

import java.net.MalformedURLException;
import java.net.URL;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.remote.DesiredCapabilities;
import org.openqa.selenium.remote.RemoteWebDriver;

import com.codeborne.selenide.WebDriverProvider;

@SuppressWarnings("deprecation")
public class SauceFirefoxDriver implements WebDriverProvider {

	SauceAuthentication auth = new SauceAuthentication();

	public WebDriver createDriver() {
		try {
			DesiredCapabilities capabillities = DesiredCapabilities.firefox();
			capabillities.setCapability("platform", "Windows 7");
			capabillities.setCapability("name", "Sauce Firefox Tests");
			return new RemoteWebDriver(new URL("http://" + auth.getUsername()
					+ ":" + auth.getToken()
					+ "@ondemand.saucelabs.com:80/wd/hub"), capabillities);
		} catch (MalformedURLException e) {
			throw new IllegalArgumentException(
					"Authentication to Sauce failed: ", e);
		}
	}
}
