package util;

import java.io.File;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.firefox.FirefoxDriver;
import org.openqa.selenium.firefox.FirefoxProfile;
import org.openqa.selenium.remote.DesiredCapabilities;

import com.codeborne.selenide.WebDriverProvider;

@SuppressWarnings("deprecation")
public class LocalFirefox implements WebDriverProvider {
	@Override
	public WebDriver createDriver() {
		FirefoxProfile profile = new FirefoxProfile(
				new File(
						"/Users/taavipauskar/Library/Application Support/Firefox/Profiles/1iz6dms6.default"));
		new DesiredCapabilities();
		DesiredCapabilities capabillities = DesiredCapabilities.firefox();
		capabillities.setCapability(FirefoxDriver.PROFILE, profile);
		return new FirefoxDriver(profile);
	}
}