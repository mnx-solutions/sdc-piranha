package com.joyent.piranha.pageobject;

import com.codeborne.selenide.SelenideElement;
import org.openqa.selenium.By;

import static com.codeborne.selenide.Selectors.byAttribute;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class CreateAccountPage extends AbstractPageObject {
    /**
     * @param aClass SignupBillingInformationPage or SignupPhoneConfirmationPage
     *              depends on phone verification feature, is it off or on
     * @return the same class as you pass
     */
    public <T extends AbstractPageObject> T clickCreateAcccount(Class<T> aClass) {
        $(By.id("createAccount")).click();
        return page(aClass);
    }

    public SelenideElement getFirstNameError() {
        return $(By.id("firstName-errors"));
    }

    public SelenideElement getLastNameError() {
        return $(By.id("lastName-errors"));
    }

    public SelenideElement getEmailError() {
        return $(By.id("email-errors"));
    }

    public SelenideElement getLoginError() {
        return $(By.id("login-errors"));
    }

    public SelenideElement getPassError() {
        return $(By.id("password-errors"));
    }

    public void createAcccount(String firstName, String lastName, String company, String email, String login, String password, String password2) {
        setFirstName(firstName);
        setLastName(lastName);
        setCompany(company);
        setEmail(email);
        setLogin(login);
        setPassword(password);
        setConfirmPassword(password2);
    }

    public void setPassword(String password) {
        setValue($("[name=\"password\"]"), password);
    }

    public void setConfirmPassword(String password) {
        setValue($(byAttribute("name", "password2")), password);
    }

    public void setLogin(String login) {
        setValue($(byAttribute("name", "login")), login);
    }

    public void setEmail(String email) {
        setValue($(byAttribute("name", "email")), email);
    }

    public void setCompany(String company) {
        setValue($(byAttribute("name", "company")), company);
    }

    public void setLastName(String lastName) {
        setValue($(byAttribute("name", "lastName")), lastName);
    }

    public void setFirstName(String firstName) {
        setValue($(byAttribute("name", "firstName")), firstName);
    }

    public SelenideElement getSigninLink(){
        return $(By.xpath("//a[contains(.,'Sign in')]"));
    }
}