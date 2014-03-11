package com.joyent.piranha.pageobject;

import com.codeborne.selenide.SelenideElement;
import org.openqa.selenium.By;

import static com.codeborne.selenide.Selectors.byAttribute;
import static com.codeborne.selenide.Selenide.$;


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
        if ($(SIGNIN_BUTTON_SELECTOR).isDisplayed()){
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

    public SelenideElement getErrorLabel(){
        return $(".alert.alert-error");
    }

    public SelenideElement getInfoLabel(){
        return $(".alert.alert-info");
    }
}
