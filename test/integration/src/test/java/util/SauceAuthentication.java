package util;

import com.saucelabs.common.SauceOnDemandAuthentication;

public class SauceAuthentication {
	private String username = System.getProperty("sauceusr");
	private String token = System.getProperty("saucetoken");
	private SauceOnDemandAuthentication authentication = new SauceOnDemandAuthentication(
			username, token);

	public SauceAuthentication() {

	}

	public SauceOnDemandAuthentication getAuthentication() {
		return authentication;
	}

	public void setAuthentication(SauceOnDemandAuthentication authentication) {
		this.authentication = authentication;
	}

	public String getUsername() {
		return username;
	}

	public void setUsername(String username) {
		this.username = username;
	}

	public String getToken() {
		return token;
	}

	public void setToken(String token) {
		this.token = token;
	}
}
