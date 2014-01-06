package util;

import java.net.MalformedURLException;
import java.net.URL;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.remote.DesiredCapabilities;
import org.openqa.selenium.remote.RemoteWebDriver;

import com.codeborne.selenide.WebDriverProvider;

@SuppressWarnings("deprecation")
public class SauceSafariDriver implements WebDriverProvider {

	SauceAuthentication auth = new SauceAuthentication();

	public WebDriver createDriver() {
		try {
			DesiredCapabilities capabillities = DesiredCapabilities.safari();
			capabillities.setCapability("platform", "OS X 10.6");
			capabillities.setCapability("name", "Sauce Safari Tests");
			return new RemoteWebDriver(new URL("http://" + auth.getUsername()
					+ ":" + auth.getToken()
					+ "@ondemand.saucelabs.com:80/wd/hub"), capabillities);
		} catch (MalformedURLException e) {
			throw new IllegalArgumentException(
					"Authentication to Sauce failed: ", e);
		}

	}

}
