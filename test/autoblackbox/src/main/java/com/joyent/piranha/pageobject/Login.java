package com.joyent.piranha.pageobject;

import com.codeborne.selenide.SelenideElement;
import org.openqa.selenium.By;

import static com.codeborne.selenide.Selectors.byAttribute;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;


public class Login extends AbstractPageObject {
    private static final By SIGNIN_BUTTON_SELECTOR = byAttribute("type", "button");
    private static final By USERNAME_INPUT_SELECTOR = byAttribute("name", "username");
    private static final By PASSWORD_INPUT_SELECTOR = byAttribute("name", "password");
    private static final String LP_SIGNIN_BUTTON_SELECTOR = "[data-ng-click=\"login();\"]";
    private static final String LOGIN_SUBMIT_SELECTOR = "#login-submit";

    /*
        public void login() {
            login(System.getProperty("loginusr"), System.getProperty("loginpw"));
        }
    */
    public void login(final String userName, final String password) {
        if ($(SIGNIN_BUTTON_SELECTOR).isDisplayed()) {
            clickSignInOnLandingPage();
        }
        setUserName(userName);
        setPassword(password);
        clickSignIn();
    }

    public void clickSignIn() {
        $(LOGIN_SUBMIT_SELECTOR).click();
    }

    public void clickSignInOnLandingPage() {
        $(LP_SIGNIN_BUTTON_SELECTOR).click();
    }

    public SelenideElement setPassword(String password) {
        return $(PASSWORD_INPUT_SELECTOR).setValue(password);
    }

    public SelenideElement setUserName(String userName) {
        return $(USERNAME_INPUT_SELECTOR).setValue(userName);
    }

    public CreateAccountPage clickSignupOnLandingPage() {
        $("[data-ng-click=\"signup();\"]").click();
        return page(CreateAccountPage.class);
    }

    public String createTestAccount(CreateAccountPage createAccountPage) {
        long timestamp = System.currentTimeMillis();
        String firstName = "autoGenerated";
        String lastName = "user" + timestamp;
        String company = "st";
        String email = lastName + "@silvertreesystems.com";
        String login = lastName;
        String password = lastName;
        String password2 = lastName;
        createAccountPage.createAcccount(firstName, lastName, company, email, login, password, password2);
        return lastName;
    }
}
